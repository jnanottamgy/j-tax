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

const result = spawnSync("npx", ["prisma", "db", "push", "--url", url], {
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
