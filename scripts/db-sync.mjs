#!/usr/bin/env node
/**
 * Bring the database in line with prisma/schema.prisma at build time.
 *
 * Exists because `prisma db push` cannot use the connection the app runs on.
 * DATABASE_URL points at Supabase's transaction pooler on port 6543, which is
 * right for serverless request traffic and cannot execute DDL — PgBouncer in
 * transaction mode has no session to hold a schema change open, so the push
 * does not fail, it simply hangs until the build times out.
 *
 * Supabase serves session mode from port 5432 on the same host, which does
 * support DDL. That is derivable from the URL already configured, so this needs
 * no second environment variable — one more thing to set is one more thing to
 * set wrongly.
 *
 * A DIRECT_URL is still honoured if one is set, since that is the conventional
 * name and someone may add it later.
 */

import { spawnSync } from "node:child_process"

const TIMEOUT_MS = 4 * 60 * 1000

function directUrlFrom(raw) {
  if (process.env.DIRECT_URL) return { url: process.env.DIRECT_URL, why: "DIRECT_URL is set" }
  if (!raw) return { url: null, why: "DATABASE_URL is not set" }

  try {
    const u = new URL(raw)
    if (u.hostname.includes("pooler.supabase.com") && u.port === "6543") {
      u.port = "5432"
      // pgbouncer=true tells Prisma to skip prepared statements. Session mode
      // supports them, and leaving the flag on suppresses nothing useful here.
      u.searchParams.delete("pgbouncer")
      return { url: u.toString(), why: "switched Supabase pooler from transaction mode (6543) to session mode (5432) for DDL" }
    }
    return { url: raw, why: "using DATABASE_URL unchanged" }
  } catch {
    return { url: raw, why: "DATABASE_URL is not parseable as a URL; using it unchanged" }
  }
}

const { url, why } = directUrlFrom(process.env.DATABASE_URL)

if (!url) {
  console.error(`\n[db-sync] Cannot sync the schema: ${why}.\n`)
  process.exit(1)
}

console.log(`[db-sync] ${why}`)
console.log(`[db-sync] host: ${(() => { try { return new URL(url).host } catch { return "unparseable" } })()}`)

/**
 * Whether the database still has no real work in it.
 *
 * `db push` refuses changes it considers lossy — adding a unique constraint,
 * dropping a column — and it is right to. But on an empty database those
 * warnings are about nothing: there are no rows to lose. On a database holding
 * a firm's clients they are a warning to take seriously.
 *
 * So the flag is decided by the data rather than set once and forgotten. This
 * is what stops `--accept-data-loss` quietly becoming permanent in a build that
 * will still be running long after anyone remembers adding it.
 */
async function databaseIsEmpty(connectionString) {
  const { default: pg } = await import("pg")
  const client = new pg.Client({ connectionString })
  try {
    await client.connect()
    for (const table of ["clients", "invoices", "tasks"]) {
      try {
        const { rows } = await client.query(`SELECT count(*)::int AS n FROM public."${table}"`)
        if (rows[0]?.n > 0) return { empty: false, table, count: rows[0].n }
      } catch {
        // Table absent is exactly the case this run is here to fix, and an
        // absent table holds no data.
      }
    }
    return { empty: true }
  } catch (err) {
    return { empty: false, unknown: true, reason: err instanceof Error ? err.message : String(err) }
  } finally {
    await client.end().catch(() => {})
  }
}

/**
 * Not every warning Prisma calls "data loss" destroys anything.
 *
 * Adding a unique constraint is flagged because it FAILS when duplicates
 * already exist — it does not delete rows. Dropping a column is a different
 * thing entirely, and the two arrive under the same heading and the same
 * --accept-data-loss flag.
 *
 * Reading the warnings tells them apart, so an additive change can go through
 * on a database with real data in it while a genuinely destructive one still
 * stops the build.
 */
function warningsAreAdditiveOnly(output) {
  const bullets = output
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("•") || l.startsWith("-"))

  if (bullets.length === 0) return { additiveOnly: false, bullets }

  const destructive = bullets.filter((l) =>
    /\b(drop|dropped|dropping|delete|deleted|removed|lose|lost|truncat)/i.test(l)
  )
  const additive = bullets.filter((l) => /will be added|be created/i.test(l))

  return {
    additiveOnly: destructive.length === 0 && additive.length === bullets.length,
    bullets,
    destructive,
  }
}

const state = await databaseIsEmpty(url)
if (state.empty) {
  console.log("[db-sync] no clients, invoices or tasks yet")
} else if (state.unknown) {
  console.log(`[db-sync] could not inspect the database (${state.reason}) — treating it as holding real data`)
} else {
  console.log(`[db-sync] ${state.table} holds ${state.count} row(s) — destructive changes will NOT be applied`)
}

function push(extraArgs = []) {
  const r = spawnSync("npx", ["prisma", "db", "push", "--url", url, ...extraArgs], {
    timeout: TIMEOUT_MS,
    env: process.env,
    encoding: "utf8",
  })
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`
  process.stdout.write(output)
  return { ...r, output }
}

let result = push()

if (result.status !== 0 && /accept-data-loss/.test(result.output)) {
  const verdict = warningsAreAdditiveOnly(result.output)

  if (state.empty) {
    console.log("\n[db-sync] database is empty — the warnings are about nothing. Retrying.\n")
    result = push(["--accept-data-loss"])
  } else if (verdict.additiveOnly) {
    console.log(
      "\n[db-sync] every warning above is something being ADDED, not removed — " +
        "nothing can be lost by applying them. Retrying.\n"
    )
    result = push(["--accept-data-loss"])
  } else {
    console.error(
      "\n[db-sync] REFUSING to continue. These changes would destroy data:\n" +
        verdict.destructive.map((l) => `    ${l}`).join("\n") +
        "\n\nThe database holds real work. Stop pushing the schema from the build " +
        "and move to migrations — see docs/DEPLOY.md.\n"
    )
  }
}

if (result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM") {
  console.error(
    "\n[db-sync] Timed out. A hang here almost always means the connection " +
      "cannot run DDL — check that DATABASE_URL is a Supabase pooler URL, or " +
      "set DIRECT_URL to the direct connection string.\n"
  )
  process.exit(1)
}

process.exit(result.status ?? 1)
