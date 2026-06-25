import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  try {
    const schemas = await prisma.$queryRawUnsafe<{ schema_name: string }[]>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('jtax_auth','jtacs_auth') ORDER BY schema_name"
    )
    console.log("AUTH_SCHEMAS:", schemas.map((s) => s.schema_name).join(",") || "(none)")
    const fns = await prisma.$queryRawUnsafe<{ nspname: string; proname: string }[]>(
      "SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname IN ('jtax_auth','jtacs_auth') ORDER BY 1,2"
    )
    console.log("FUNCTIONS:", fns.map((f) => `${f.nspname}.${f.proname}`).join(",") || "(none)")
    const tables = await prisma.$queryRawUnsafe<{ table_name: string; rowsecurity: boolean }[]>(
      "SELECT c.relname AS table_name, c.relrowsecurity AS rowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname"
    )
    const enabled = tables.filter((t) => t.rowsecurity).length
    console.log(`RLS_TABLES: ${enabled}/${tables.length} have RLS enabled`)
    const policies = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT count(*)::bigint AS count FROM pg_policies WHERE schemaname='public'"
    )
    console.log("POLICY_COUNT:", Number(policies[0].count))

    const policyExpr = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT count(*)::bigint AS count FROM pg_policies WHERE schemaname='public' AND (qual ILIKE '%jtax_auth%' OR qual ILIKE '%jtacs_auth%' OR with_check ILIKE '%jtax_auth%' OR with_check ILIKE '%jtacs_auth%')"
    )
    console.log("POLICIES_REFERENCING_AUTH_HELPER:", Number(policyExpr[0].count))

    const jtaxRef = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT count(*)::bigint AS count FROM pg_policies WHERE schemaname='public' AND (qual ILIKE '%jtax_auth%' OR with_check ILIKE '%jtax_auth%')"
    )
    console.log("POLICIES_USING_JTAX_AUTH:", Number(jtaxRef[0].count))

    const jtacsRef = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      "SELECT count(*)::bigint AS count FROM pg_policies WHERE schemaname='public' AND (qual ILIKE '%jtacs_auth%' OR with_check ILIKE '%jtacs_auth%')"
    )
    console.log("POLICIES_USING_JTACS_AUTH:", Number(jtacsRef[0].count))
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.message : String(e))
  }
  await prisma.$disconnect()
}
main()
