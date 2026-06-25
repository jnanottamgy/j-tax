import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function asRole(role: string, uid: string) {
  let out = ""
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('request.jwt.claims', '${JSON.stringify({
        role: "authenticated", sub: uid, app_metadata: { role },
      }).replace(/'/g, "''")}', true);`
    )
    const r = await tx.$queryRawUnsafe<{ role: string }[]>(`SELECT jtacs_auth.user_role() AS role;`)
    out = r[0]?.role
    throw new Error("__rollback__")
  }).catch((e) => { if (!(e instanceof Error && e.message === "__rollback__")) throw e })
  return out
}

async function main() {
  for (const r of ["PARTNER", "MANAGER", "EMPLOYEE", "CLIENT", "BOGUS"]) {
    const got = await asRole(r, "11111111-1111-1111-1111-111111111111")
    console.log(`  jtacs_auth.user_role() with app_metadata.role='${r}' → ${got}`)
  }
  // empty JWT
  let out = ""
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('request.jwt.claims', '', true);`)
    const r = await tx.$queryRawUnsafe<{ role: string | null }[]>(`SELECT jtacs_auth.user_role() AS role;`)
    out = String(r[0]?.role ?? "(null)")
    throw new Error("__rollback__")
  }).catch((e) => { if (!(e instanceof Error && e.message === "__rollback__")) throw e })
  console.log(`  jtacs_auth.user_role() with no JWT → ${out}`)
  await prisma.$disconnect()
}
main()
