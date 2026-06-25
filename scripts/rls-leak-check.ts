import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  for (const t of ["compliance_events", "client_timeline_events", "messages", "documents", "tasks"]) {
    try {
      const tot = await prisma.$queryRawUnsafe<{n: number}[]>(`SELECT count(*)::int AS n FROM "${t}"`)
      const nul = await prisma.$queryRawUnsafe<{n: number}[]>(`SELECT count(*)::int AS n FROM "${t}" WHERE "clientId" IS NULL`)
      console.log(`${t.padEnd(28)} total=${tot[0].n}  clientId_null=${nul[0].n}`)
    } catch (e) {
      console.log(`${t.padEnd(28)} (no clientId column or query error)`)
    }
  }
  await prisma.$disconnect()
}
main()
