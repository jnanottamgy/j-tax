/**
 * Applies prisma/migrations-manual/002_rls_policies.sql and 004_*.sql to the
 * live Supabase database, then drops the orphaned legacy `jtax_auth` schema
 * if (and only if) no policies still reference it.
 *
 * Idempotent — safe to re-run.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
import { readFileSync } from "node:fs"
import { join } from "node:path"

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const sql002 = readFileSync(
      join(process.cwd(), "prisma", "migrations-manual", "002_rls_policies.sql"),
      "utf8"
    )
    const sql004 = readFileSync(
      join(process.cwd(), "prisma", "migrations-manual", "004_rls_compliance_events_tightening.sql"),
      "utf8"
    )

    console.log("[1/4] Applying 002_rls_policies.sql ...")
    await prisma.$executeRawUnsafe(sql002)
    console.log("       OK")

    console.log("[2/4] Applying 004_rls_compliance_events_tightening.sql ...")
    await prisma.$executeRawUnsafe(sql004)
    console.log("       OK")

    console.log("[3/4] Verifying no policy still references jtax_auth ...")
    const stillUsingJtax = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT count(*)::bigint AS count FROM pg_policies WHERE schemaname='public' AND (qual ILIKE '%jtax_auth%' OR with_check ILIKE '%jtax_auth%')"
    )
    const remaining = Number(stillUsingJtax[0].count)
    console.log(`       policies still referencing jtax_auth: ${remaining}`)

    if (remaining === 0) {
      console.log("[4/4] Dropping legacy jtax_auth schema ...")
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS jtax_auth CASCADE`)
      console.log("       OK")
    } else {
      console.log("[4/4] SKIPPED — policies still reference jtax_auth; leaving schema in place")
    }

    const finalSchemas = await prisma.$queryRawUnsafe<{ schema_name: string }[]>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('jtax_auth','jtacs_auth') ORDER BY schema_name"
    )
    console.log("FINAL_SCHEMAS:", finalSchemas.map((s) => s.schema_name).join(",") || "(none)")
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
  await prisma.$disconnect()
}
main()
