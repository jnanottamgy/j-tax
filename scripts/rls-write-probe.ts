/**
 * RLS Write-Probe — separate from rls-certify.ts because it mutates the DB.
 *
 * Inserts a tombstone row, then attempts UPDATEs under each role to determine
 * whether the policies block writes. Cleans up afterwards.
 *
 *   npx tsx -r dotenv/config scripts/rls-write-probe.ts
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(2) }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type Result = { role: string; op: string; expected: "ALLOW" | "DENY"; outcome: "ALLOWED" | "DENIED" | "NO-OP"; detail: string }
const results: Result[] = []

async function probe() {
  // ── Setup: seed a singleton firm_settings row (clean up after) ──────────
  console.log("[setup] ensuring firm_settings singleton exists for write probe…")
  await prisma.$executeRawUnsafe(`
    INSERT INTO firm_settings (id, "firmName", "fromEmail", "updatedAt")
    VALUES ('singleton','RLS Probe Firm','probe@example.com', NOW())
    ON CONFLICT (id) DO UPDATE SET "firmName" = EXCLUDED."firmName";
  `)
  console.log("[setup] also ensuring a leads row exists (PARTNER/MANAGER ALL, EMPLOYEE deny)…")
  // Create a deterministic test lead we can target
  await prisma.$executeRawUnsafe(`
    INSERT INTO leads (id, name, email, source, status, "createdBy", "createdAt", "updatedAt")
    VALUES ('rls-probe-lead', 'Probe Lead', 'probe@example.com', 'OTHER', 'NEW_LEAD',
            (SELECT id FROM "User" WHERE role='PARTNER' LIMIT 1), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `).catch((e) => console.log("[setup] leads seed skipped:", String(e).split("\n")[0]))

  // ── Helper to run as a JWT-bearing role ─────────────────────────────────
  // tx typed any so $queryRawUnsafe generics work — Prisma's transactional
  // client type doesn't preserve the generic on $queryRawUnsafe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function asRole(roleName: string, uid: string, fn: (tx: any) => Promise<void>) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('request.jwt.claims', '${JSON.stringify({
            role: "authenticated",
            sub: uid,
            app_metadata: { role: roleName },
          }).replace(/'/g, "''")}', true);`
        )
        await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated;`)
        await fn(tx)
        throw new Error("__rollback__") // never commit probe mutations
      })
    } catch (e) {
      if (!(e instanceof Error && e.message === "__rollback__")) {
        // genuine error — surface via the result
        throw e
      }
    }
  }

  const partnerUid = (await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id::text AS id FROM "User" WHERE role='PARTNER' LIMIT 1`
  ))[0]?.id ?? "00000000-0000-0000-0000-000000000001"
  const managerUid = "00000000-0000-0000-0000-000000000002"
  const employeeUid = "00000000-0000-0000-0000-000000000003"

  // ── Probe 1: firm_settings UPDATE ──────────────────────────────────────
  // Expected: PARTNER allowed, MANAGER & EMPLOYEE denied (READ-only)
  for (const { roleName, uid, expected } of [
    { roleName: "PARTNER",  uid: partnerUid,  expected: "ALLOW" as const },
    { roleName: "MANAGER",  uid: managerUid,  expected: "DENY"  as const },
    { roleName: "EMPLOYEE", uid: employeeUid, expected: "DENY"  as const },
  ]) {
    try {
      await asRole(roleName, uid, async (tx) => {
        const r = await (tx.$queryRawUnsafe as <T>(sql: string, ...args: unknown[]) => Promise<T>)<{ n: number }[]>(`
          WITH u AS (
            UPDATE firm_settings SET "firmName" = 'HIJACKED-BY-' || $1
             WHERE id = 'singleton'
            RETURNING 1 AS n
          )
          SELECT count(*)::int AS n FROM u;
        `, roleName)
        const n = Number(r[0]?.n ?? 0)
        results.push({
          role: roleName,
          op: "UPDATE firm_settings",
          expected,
          outcome: n > 0 ? "ALLOWED" : "DENIED",
          detail: n > 0 ? `${n} row(s) modified` : `policy blocked — 0 rows modified`,
        })
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e)
      results.push({
        role: roleName,
        op: "UPDATE firm_settings",
        expected,
        outcome: "DENIED",
        detail: `error: ${msg}`,
      })
    }
  }

  // ── Probe 2: firm_settings INSERT (also write) ─────────────────────────
  for (const { roleName, uid, expected } of [
    { roleName: "MANAGER",  uid: managerUid,  expected: "DENY"  as const },
    { roleName: "EMPLOYEE", uid: employeeUid, expected: "DENY"  as const },
  ]) {
    try {
      await asRole(roleName, uid, async (tx) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO firm_settings (id, "firmName", "fromEmail", "updatedAt")
          VALUES ('inserted-by-${roleName.toLowerCase()}', 'Escalation Attempt',
                  'attacker@example.com', NOW());
        `)
        results.push({
          role: roleName, op: "INSERT firm_settings", expected,
          outcome: "ALLOWED",
          detail: "INSERT succeeded — privilege escalation",
        })
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e)
      results.push({
        role: roleName, op: "INSERT firm_settings", expected,
        outcome: "DENIED",
        detail: `error: ${msg}`,
      })
    }
  }

  // ── Probe 3: audit_logs SELECT (MANAGER/EMPLOYEE must be DENIED) ───────
  for (const { roleName, uid } of [
    { roleName: "MANAGER",  uid: managerUid  },
    { roleName: "EMPLOYEE", uid: employeeUid },
  ]) {
    try {
      await asRole(roleName, uid, async (tx) => {
        const r = await (tx.$queryRawUnsafe as <T>(sql: string, ...args: unknown[]) => Promise<T>)<{ n: number }[]>(`SELECT count(*)::int AS n FROM audit_logs`)
        const n = Number(r[0]?.n ?? 0)
        results.push({
          role: roleName, op: "SELECT audit_logs", expected: "DENY",
          outcome: n === 0 ? "DENIED" : "ALLOWED",
          detail: n === 0 ? "0 rows visible (correct)" : `${n} rows leaked`,
        })
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e)
      results.push({
        role: roleName, op: "SELECT audit_logs", expected: "DENY",
        outcome: "DENIED",
        detail: `error: ${msg}`,
      })
    }
  }

  // ── Probe 4: leads SELECT (EMPLOYEE must be DENIED) ────────────────────
  await asRole("EMPLOYEE", employeeUid, async (tx) => {
    try {
      const r = await (tx.$queryRawUnsafe as <T>(sql: string, ...args: unknown[]) => Promise<T>)<{ n: number }[]>(`SELECT count(*)::int AS n FROM leads`)
      const n = Number(r[0]?.n ?? 0)
      results.push({
        role: "EMPLOYEE", op: "SELECT leads", expected: "DENY",
        outcome: n === 0 ? "DENIED" : "ALLOWED",
        detail: n === 0 ? "0 rows visible (correct)" : `${n} rows leaked`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e)
      results.push({
        role: "EMPLOYEE", op: "SELECT leads", expected: "DENY",
        outcome: "DENIED",
        detail: `error: ${msg}`,
      })
    }
  })

  // ── Probe 5: invoices INSERT under EMPLOYEE ────────────────────────────
  await asRole("EMPLOYEE", employeeUid, async (tx) => {
    try {
      await tx.$executeRawUnsafe(`
        INSERT INTO invoices (id, "invoiceNumber", "clientId", amount, "issueDate", "dueDate", status, "createdBy", "createdAt", "updatedAt")
        VALUES ('rls-probe-inv', 'INV-RLS-PROBE',
                (SELECT id FROM clients LIMIT 1),
                1000, NOW(), NOW(), 'DRAFT',
                '${employeeUid}', NOW(), NOW());
      `)
      results.push({
        role: "EMPLOYEE", op: "INSERT invoices", expected: "DENY",
        outcome: "ALLOWED",
        detail: "INSERT succeeded — privilege escalation",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : String(e)
      results.push({
        role: "EMPLOYEE", op: "INSERT invoices", expected: "DENY",
        outcome: "DENIED",
        detail: `error: ${msg}`,
      })
    }
  })

  // ── Cleanup ────────────────────────────────────────────────────────────
  console.log("[cleanup] removing seeded probe rows…")
  await prisma.$executeRawUnsafe(`DELETE FROM leads WHERE id = 'rls-probe-lead'`).catch(() => {})
  // Leave firm_settings singleton in place (it's a singleton; system needs it)

  // ── Print ──────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(78))
  console.log("RLS Write-Probe Results")
  console.log("─".repeat(78))
  let pass = 0, fail = 0
  for (const r of results) {
    const ok = r.outcome === (r.expected === "ALLOW" ? "ALLOWED" : "DENIED")
    const mark = ok ? "✓" : "✗"
    console.log(`  ${mark} ${r.role.padEnd(8)} ${r.op.padEnd(28)} expect=${r.expected.padEnd(5)} got=${r.outcome.padEnd(7)} — ${r.detail}`)
    if (ok) pass++; else fail++
  }
  console.log("─".repeat(78))
  console.log(`Write-probe: ${pass} pass, ${fail} fail`)
  console.log("─".repeat(78))

  await prisma.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

probe().catch(async (e) => {
  console.error("Probe crashed:", e)
  await prisma.$disconnect()
  process.exit(2)
})
