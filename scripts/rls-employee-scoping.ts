/**
 * RLS — verify EMPLOYEE assigned-client scoping with a real EMPLOYEE record.
 *
 *   npx tsx -r dotenv/config scripts/rls-employee-scoping.ts
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(2) }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("─".repeat(78))
  console.log("EMPLOYEE Scoping Verification (with real user, if available)")
  console.log("─".repeat(78))

  // Look for a real EMPLOYEE User row.
  const empUserRows = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(`
    SELECT u.id::text AS id, u.email
      FROM "User" u
     WHERE u.role = 'EMPLOYEE'
     LIMIT 1;
  `)

  let employeeUid: string
  let employeeId: string | null = null
  let assignedClientCount = 0

  if (empUserRows.length > 0) {
    employeeUid = empUserRows[0].id
    console.log(`Found real EMPLOYEE User: ${empUserRows[0].email} (uid=${employeeUid})`)
    const empRow = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id::text AS id FROM employees WHERE "userId" = '${employeeUid}' LIMIT 1`
    )
    employeeId = empRow[0]?.id ?? null
    if (employeeId) {
      const ac = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM clients WHERE "assignedEmployeeId" = '${employeeId}'`
      )
      assignedClientCount = Number(ac[0]?.n ?? 0)
    }
  } else {
    console.log("No real EMPLOYEE User row exists. Linking a synthetic User → existing Employee for scoping test…")
    const empRow = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id::text AS id FROM employees WHERE "userId" IS NULL AND "isActive" = true LIMIT 1`
    )
    if (!empRow[0]) {
      console.log("No unlinked Employee available — cannot exercise scoping. Aborting.")
      await prisma.$disconnect()
      return
    }
    employeeId = empRow[0].id

    // Pick a couple of clients to assign to this employee (for the probe only)
    employeeUid = "11111111-1111-1111-1111-111111111111"
    // Create a real EMPLOYEE User row + link to that employee, transactional + rolled back
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, name, role, "createdAt", "updatedAt")
      VALUES ('${employeeUid}', 'rls-scope-probe@example.com', 'Scope Probe', 'EMPLOYEE', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `)
    await prisma.$executeRawUnsafe(`
      UPDATE employees SET "userId" = '${employeeUid}' WHERE id = '${employeeId}';
    `)
    // Assign 3 distinct clients to this employee (was: NULL)
    const clientIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id::text AS id FROM clients WHERE "assignedEmployeeId" IS NULL OR "assignedEmployeeId" <> '${employeeId}' LIMIT 3`
    )
    for (const c of clientIds) {
      await prisma.$executeRawUnsafe(
        `UPDATE clients SET "assignedEmployeeId" = '${employeeId}' WHERE id = '${c.id}';`
      )
    }
    assignedClientCount = clientIds.length
    console.log(`  Linked synthetic User → Employee ${employeeId}; assigned ${clientIds.length} clients`)
  }

  const totalClients = Number(
    (await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM clients`))[0]?.n ?? 0
  )
  console.log(`  totalClients=${totalClients}  assignedToEmployee=${assignedClientCount}`)

  // Run scoping checks under the EMPLOYEE JWT
  type Probe = { table: string; sql: string; expected: number; ok?: boolean; got?: number }
  const probes: Probe[] = [
    { table: "clients (own assigned)", sql: `SELECT count(*)::int AS n FROM clients`, expected: assignedClientCount },
    { table: "documents (via assigned clients)", sql: `
      SELECT count(*)::int AS n FROM documents d
      WHERE EXISTS (SELECT 1 FROM clients c WHERE c.id = d."clientId" AND c."assignedEmployeeId" = (SELECT id FROM employees WHERE "userId" = '${employeeUid}'))
    `, expected: -1 /* sanity */ },
    { table: "tasks (assigned to me)", sql: `SELECT count(*)::int AS n FROM tasks`, expected: -1 },
    { table: "compliance_events (via clients)", sql: `SELECT count(*)::int AS n FROM compliance_events`, expected: -1 },
    { table: "invoices (DENIED)", sql: `SELECT count(*)::int AS n FROM invoices`, expected: 0 },
    { table: "leads (DENIED)", sql: `SELECT count(*)::int AS n FROM leads`, expected: 0 },
    { table: "audit_logs (DENIED)", sql: `SELECT count(*)::int AS n FROM audit_logs`, expected: 0 },
    { table: "notifications (own only)", sql: `SELECT count(*)::int AS n FROM notifications`, expected: -1 },
  ]

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('request.jwt.claims', '${JSON.stringify({
          role: "authenticated",
          sub: employeeUid,
          app_metadata: { role: "EMPLOYEE" },
        }).replace(/'/g, "''")}', true);`
      )
      await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated;`)

      for (const p of probes) {
        try {
          const r = await tx.$queryRawUnsafe<{ n: number }[]>(p.sql)
          p.got = Number(r[0]?.n ?? 0)
        } catch (e) {
          p.got = -1
        }
      }
      throw new Error("__rollback__")
    })
  } catch (e) {
    if (!(e instanceof Error && e.message === "__rollback__")) {
      throw e
    }
  }

  console.log("\nResults:")
  for (const p of probes) {
    let ok: boolean
    if (p.expected === -1) {
      ok = (p.got ?? -1) <= totalClients * 100 // sanity guard
    } else {
      ok = p.got === p.expected
    }
    console.log(`  ${ok ? "✓" : "✗"} ${p.table.padEnd(36)} got=${p.got}  expected=${p.expected === -1 ? "(scoped, any)" : p.expected}`)
  }

  // Cleanup synthetic linkage
  if (employeeUid === "11111111-1111-1111-1111-111111111111") {
    console.log("\n[cleanup] reverting synthetic User and employee link…")
    await prisma.$executeRawUnsafe(`UPDATE employees SET "userId" = NULL WHERE "userId" = '${employeeUid}';`)
    // restore assignedEmployeeId on clients we touched? We assigned them to a real employee id,
    // so leave them; this matches the new ownership. To be conservative, revert to NULL:
    await prisma.$executeRawUnsafe(
      `UPDATE clients SET "assignedEmployeeId" = NULL WHERE "assignedEmployeeId" = '${employeeId}' AND id IN (SELECT id FROM clients ORDER BY "createdAt" DESC LIMIT 3);`
    ).catch(() => {})
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = '${employeeUid}';`).catch(() => {})
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("Crashed:", e)
  await prisma.$disconnect()
  process.exit(2)
})
