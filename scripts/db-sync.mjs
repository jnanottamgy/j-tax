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

const state = await databaseIsEmpty(url)
const args = ["prisma", "db", "push", "--url", url]

if (state.empty) {
  console.log("[db-sync] no clients, invoices or tasks yet — lossy changes are about nothing, accepting them")
  args.push("--accept-data-loss")
} else if (state.unknown) {
  console.log(`[db-sync] could not check whether the database holds data (${state.reason}) — refusing to accept lossy changes`)
} else {
  console.log(
    `[db-sync] ${state.table} holds ${state.count} row(s) — NOT accepting lossy changes. ` +
      "If the push fails on a data-loss warning, stop pushing from the build and " +
      "switch to migrations. See docs/DEPLOY.md."
  )
}

const result = spawnSync("npx", args, {
  stdio: "inherit",
  timeout: TIMEOUT_MS,
  env: process.env,
})

if (result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM") {
  console.error(
    "\n[db-sync] Timed out. A hang here almost always means the connection " +
      "cannot run DDL — check that DATABASE_URL is a Supabase pooler URL, or " +
      "set DIRECT_URL to the direct connection string.\n"
  )
  process.exit(1)
}

process.exit(result.status ?? 1)
