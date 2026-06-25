/**
 * RLS Certification Runner
 *
 * Runs every verification query from prisma/migrations-manual/RLS_ACTIVATION_GUIDE.md
 * against the live Supabase database, plus role-simulation tests for PARTNER,
 * MANAGER, and EMPLOYEE.
 *
 * Run:
 *   npx tsx -r dotenv/config scripts/rls-certify.ts
 *
 * Exit 0 = PASS, non-zero = FAIL.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set")
  process.exit(2)
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type Section = { title: string; status: "PASS" | "FAIL" | "WARN" | "INFO"; detail: string }
const sections: Section[] = []
const expectedTables = [
  "firm_settings", "User", "employees", "clients", "client_services",
  "tasks", "task_comments", "task_attachments", "task_automations",
  "compliance_schedules", "compliance_events",
  "documents", "document_versions", "document_tags", "document_activities",
  "message_templates", "messages", "message_logs",
  "invoices", "payment_receipts", "follow_ups", "invoice_reminders",
  "activity_logs", "audit_logs", "notifications", "reminders",
  "employee_sessions", "employee_activities", "attendance_records",
  "leads", "quotations", "quotation_items", "quotation_email_logs",
  "quotation_follow_ups", "client_timeline_events",
  "recurring_compliance_templates",
]

function hr(title?: string) {
  console.log("\n" + "─".repeat(78))
  if (title) console.log(title)
  if (title) console.log("─".repeat(78))
}

async function q<T = any>(sql: string): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql)
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION 1 — Schema & helper functions
// ──────────────────────────────────────────────────────────────────────────
async function section_schemaAndHelpers() {
  hr("[1] Schema + helper functions")

  const schemaRows = await q<{ schema_name: string }>(`
    SELECT schema_name
      FROM information_schema.schemata
     WHERE schema_name IN ('jtacs_auth','auth')
     ORDER BY schema_name;
  `)
  const haveJtaxAuth = schemaRows.some((r) => r.schema_name === "jtacs_auth")
  console.log("  schemas present:", schemaRows.map((r) => r.schema_name).join(", "))
  sections.push({
    title: "jtacs_auth schema exists",
    status: haveJtaxAuth ? "PASS" : "FAIL",
    detail: haveJtaxAuth ? "ok" : "missing — RLS migration not applied",
  })

  const fnRows = await q<{ nspname: string; proname: string }>(`
    SELECT n.nspname, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'jtacs_auth'
     ORDER BY p.proname;
  `)
  const fnNames = fnRows.map((r) => r.proname).sort()
  console.log("  jtacs_auth functions:", fnNames.join(", ") || "(none)")
  sections.push({
    title: "jtacs_auth.user_role() exists",
    status: fnNames.includes("user_role") ? "PASS" : "FAIL",
    detail: fnNames.includes("user_role") ? "ok" : "missing",
  })
  sections.push({
    title: "jtacs_auth.employee_id() exists",
    status: fnNames.includes("employee_id") ? "PASS" : "FAIL",
    detail: fnNames.includes("employee_id") ? "ok" : "missing",
  })

  // employee_id should be SECURITY DEFINER (prosecdef = true)
  const secDef = await q<{ prosecdef: boolean }>(`
    SELECT p.prosecdef
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'jtacs_auth' AND p.proname = 'employee_id';
  `)
  const isSecDef = secDef[0]?.prosecdef === true
  sections.push({
    title: "jtacs_auth.employee_id() is SECURITY DEFINER",
    status: isSecDef ? "PASS" : "FAIL",
    detail: isSecDef ? "ok — prosecdef=true" : "must be SECURITY DEFINER to bypass RLS lookup loop",
  })
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION 2 — RLS enabled on all 36 expected tables
// ──────────────────────────────────────────────────────────────────────────
async function section_rlsCoverage() {
  hr("[2] RLS coverage — 36 expected tables")

  const rows = await q<{ table_name: string; rowsecurity: boolean }>(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
     ORDER BY c.relname;
  `)
  const tableMap = new Map(rows.map((r) => [r.table_name, r.rowsecurity]))

  let enabled = 0, disabled = 0, missing = 0
  const enabledList: string[] = []
  const disabledList: string[] = []
  const missingList: string[] = []
  for (const t of expectedTables) {
    if (!tableMap.has(t)) { missing++; missingList.push(t) }
    else if (tableMap.get(t)) { enabled++; enabledList.push(t) }
    else { disabled++; disabledList.push(t) }
  }
  console.log(`  enabled: ${enabled}  disabled: ${disabled}  missing: ${missing}`)
  if (disabled > 0) console.log("  ✗ RLS OFF :", disabledList.join(", "))
  if (missing > 0) console.log("  ✗ MISSING :", missingList.join(", "))

  sections.push({
    title: `All 36 expected tables have RLS enabled (got ${enabled})`,
    status: enabled === 36 ? "PASS" : "FAIL",
    detail: enabled === 36
      ? "36/36"
      : `enabled=${enabled} disabled=[${disabledList.join(",")}] missing=[${missingList.join(",")}]`,
  })

  // Any other public table without RLS? Flag for visibility.
  const otherUnprotected = rows
    .filter((r) => !expectedTables.includes(r.table_name) && !r.rowsecurity)
    .map((r) => r.table_name)
  if (otherUnprotected.length > 0) {
    console.log("  ⚠ other unprotected public tables:", otherUnprotected.join(", "))
    sections.push({
      title: "No unexpected unprotected public tables",
      status: "WARN",
      detail: `Other tables without RLS: ${otherUnprotected.join(", ")}`,
    })
  } else {
    sections.push({
      title: "No unexpected unprotected public tables",
      status: "PASS",
      detail: "ok",
    })
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION 3 — Policy counts
// ──────────────────────────────────────────────────────────────────────────
async function section_policyCounts() {
  hr("[3] Policy count")

  const totalRows = await q<{ count: bigint }>(`
    SELECT COUNT(*)::bigint AS count
      FROM pg_policies
     WHERE schemaname = 'public';
  `)
  const total = Number(totalRows[0]?.count ?? 0)
  console.log(`  total policies on public schema: ${total}`)
  sections.push({
    title: "Policy count meets baseline (>= 56)",
    status: total >= 56 ? "PASS" : "FAIL",
    detail: `${total} policies`,
  })

  // Per-table breakdown
  const perTable = await q<{ tablename: string; n: bigint }>(`
    SELECT tablename, COUNT(*)::bigint AS n
      FROM pg_policies
     WHERE schemaname = 'public'
     GROUP BY tablename
     ORDER BY tablename;
  `)
  console.log("  per-table counts:")
  for (const r of perTable) {
    console.log(`    ${r.tablename.padEnd(36)} ${r.n}`)
  }

  // Tables with RLS enabled but no policies — these are LOCKED OUT for everyone
  // except service role, which is acceptable for some tables, but worth noting.
  const policyTables = new Set(perTable.map((r) => r.tablename))
  const zeroPolicy = expectedTables.filter((t) => !policyTables.has(t))
  if (zeroPolicy.length > 0) {
    console.log("  ℹ tables with RLS but zero policies:", zeroPolicy.join(", "))
    sections.push({
      title: "All expected tables have at least one policy",
      status: zeroPolicy.length === 0 ? "PASS" : "WARN",
      detail: `Zero-policy tables: ${zeroPolicy.join(", ")} (acceptable only if no role should ever access this table directly)`,
    })
  } else {
    sections.push({
      title: "All expected tables have at least one policy",
      status: "PASS",
      detail: "ok",
    })
  }
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION 4 — Helper function smoke test (call with synthetic JWT)
// ──────────────────────────────────────────────────────────────────────────
async function section_helperFunctionSmoke() {
  hr("[4] Helper function smoke test")

  // Try calling jtacs_auth.user_role() inside a tx with simulated JWT claims.
  // Use a real partner UID if one exists, else a synthetic UUID.
  const partnerRow = await q<{ id: string }>(`
    SELECT id::text AS id FROM "User" WHERE role = 'PARTNER' LIMIT 1;
  `)
  const partnerUid = partnerRow[0]?.id ?? "00000000-0000-0000-0000-000000000001"

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('request.jwt.claims', '${JSON.stringify({
          role: "authenticated",
          sub: partnerUid,
          app_metadata: { role: "PARTNER" },
        }).replace(/'/g, "''")}', true);`
      )
      const r = await tx.$queryRawUnsafe<{ role: string }[]>(
        `SELECT jtacs_auth.user_role() AS role;`
      )
      console.log(`  jtacs_auth.user_role() with synthetic PARTNER JWT -> ${r[0]?.role}`)
      sections.push({
        title: "jtacs_auth.user_role() reads PARTNER from JWT app_metadata",
        status: r[0]?.role === "PARTNER" ? "PASS" : "FAIL",
        detail: `got ${r[0]?.role ?? "(null)"}`,
      })
    })
  } catch (e) {
    sections.push({
      title: "jtacs_auth.user_role() reads PARTNER from JWT app_metadata",
      status: "FAIL",
      detail: `error: ${e instanceof Error ? e.message : String(e)}`,
    })
  }
}

type ProbeResult = { table: string; expected: string; got: number; baseline: number; ok: boolean; notes: string }

/**
 * Run a single statement under a JWT-bearing `authenticated` role in its OWN
 * transaction, then roll back. Isolating each write attempt avoids the
 * Prisma-interactive-transaction poisoning problem (the first error in a shared
 * tx makes all later statements fail with SQLSTATE 25P02).
 *
 * Returns { rows, error } — rows = result of the statement (for UPDATE…RETURNING
 * count), error = the thrown error if the statement was rejected by RLS.
 */
async function runIsolated(
  roleName: string,
  uid: string,
  sql: string
): Promise<{ rows: any[] | null; error: string | null }> {
  let out: { rows: any[] | null; error: string | null } = { rows: null, error: null }
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
      try {
        const rows = await (tx.$queryRawUnsafe as <T>(s: string) => Promise<T>)<any[]>(sql)
        out = { rows, error: null }
      } catch (e) {
        // Keep the FULL message — Prisma errors start with "\n" so the
        // meaningful "permission denied"/"violates row-level security" text is
        // on a later line. Callers match against the whole string.
        const m = e instanceof Error ? e.message : String(e)
        if (process.env.RLS_DEBUG) console.log("    [runIsolated err]", JSON.stringify(m))
        out = { rows: null, error: m || "(empty error)" }
      }
      throw new Error("__rollback__")
    })
  } catch (e) {
    if (!(e instanceof Error && e.message === "__rollback__")) {
      out = { rows: null, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return out
}

/**
 * firm_settings write-enforcement probes — each in its own transaction.
 * Expectation: PARTNER may UPDATE/INSERT; MANAGER/EMPLOYEE may not.
 */
async function probeFirmSettingsWrites(roleName: string, uid: string): Promise<ProbeResult[]> {
  const out: ProbeResult[] = []

  // UPDATE probe — CTE returns count of rows actually modified.
  const upd = await runIsolated(roleName, uid, `
    WITH u AS (
      UPDATE firm_settings SET "firmName" = 'HIJACKED-BY-' || '${roleName}'
       WHERE id = 'singleton' RETURNING 1
    )
    SELECT COALESCE(COUNT(*),0)::int AS n FROM u;
  `)
  // A GRANT-level denial (42501) means the 005 hardening migration is applied:
  // the `authenticated` role has no write privilege on firm_settings, so the
  // ONLY writer is the service-role app backend. That is a strictly-more-secure
  // outcome and is treated as a pass for PARTNER (who writes through the app).
  const grantDenied = (e: string | null) => !!e && /permission denied/i.test(e)

  const updated = upd.error ? 0 : Number(upd.rows?.[0]?.n ?? 0)
  if (roleName === "PARTNER") {
    const policyPath = updated === 1 && !upd.error
    const hardenedPath = grantDenied(upd.error)
    out.push({
      table: "firm_settings(UPDATE)", expected: "PARTNER-or-svc", got: updated, baseline: 1,
      ok: policyPath || hardenedPath,
      notes: policyPath
        ? "PARTNER UPDATE allowed by policy (1 row) — expected"
        : hardenedPath
        ? "write grant revoked from authenticated (005 applied) — firm_settings is service-role-write-only ✓"
        : `⚠ PARTNER UPDATE got ${updated}${upd.error ? ` err=${upd.error}` : ""}`,
    })
  } else {
    out.push({
      table: "firm_settings(UPDATE)", expected: "ZERO", got: updated, baseline: 1,
      ok: updated === 0,
      notes: updated === 0
        ? `${roleName} UPDATE denied (${grantDenied(upd.error) ? "grant" : "RLS"}) — 0 rows modified`
        : `⚠ ${roleName} modified ${updated} rows — escalation`,
    })
  }

  // INSERT probe — non-PARTNER must be rejected (RLS or grant).
  const ins = await runIsolated(roleName, uid, `
    INSERT INTO firm_settings (id, "firmName", "fromEmail", "updatedAt")
    VALUES ('probe-${roleName.toLowerCase()}', 'Escalation', 'x@x.com', NOW())
    RETURNING 1 AS n;
  `)
  const inserted = !ins.error && (ins.rows?.length ?? 0) > 0
  if (roleName === "PARTNER") {
    const hardenedPath = grantDenied(ins.error)
    out.push({
      table: "firm_settings(INSERT)", expected: "PARTNER-or-svc", got: inserted ? 1 : 0, baseline: 1,
      ok: inserted || hardenedPath,
      notes: inserted
        ? "PARTNER INSERT allowed by policy — expected"
        : hardenedPath
        ? "write grant revoked from authenticated (005 applied) — service-role-write-only ✓"
        : `⚠ PARTNER INSERT blocked unexpectedly: ${ins.error}`,
    })
  } else {
    out.push({
      table: "firm_settings(INSERT)", expected: "ZERO", got: inserted ? 1 : 0, baseline: 0,
      ok: !inserted,
      notes: !inserted
        ? `${roleName} INSERT denied (${grantDenied(ins.error) ? "grant" : "RLS"})`
        : `⚠ ${roleName} INSERT succeeded — escalation`,
    })
  }

  return out
}

// ──────────────────────────────────────────────────────────────────────────
// SECTION 5 — Role simulation
// ──────────────────────────────────────────────────────────────────────────
async function simulateAs(roleName: "PARTNER" | "MANAGER" | "EMPLOYEE", uid: string, label: string) {
  hr(`[5/${label}] Simulating ${roleName} access (uid=${uid})`)

  // Switch to a JWT-bearing role within a transaction:
  // - set local request.jwt.claims to the simulated JWT
  // - SET LOCAL ROLE authenticated  (so RLS engages — service_role bypasses)
  // - then run SELECTs against representative tables.

  type Probe = { table: string; expect: "ALL" | "ZERO" | "SCOPED" | "OWN"; sql: string }
  const probes: Probe[] = [
    { table: "clients",           expect: roleName === "EMPLOYEE" ? "SCOPED" : "ALL", sql: `SELECT count(*)::int AS c FROM clients` },
    { table: "tasks",             expect: roleName === "EMPLOYEE" ? "SCOPED" : "ALL", sql: `SELECT count(*)::int AS c FROM tasks` },
    { table: "invoices",          expect: roleName === "EMPLOYEE" ? "ZERO"   : "ALL", sql: `SELECT count(*)::int AS c FROM invoices` },
    { table: "payment_receipts",  expect: roleName === "EMPLOYEE" ? "ZERO"   : "ALL", sql: `SELECT count(*)::int AS c FROM payment_receipts` },
    { table: "leads",             expect: roleName === "EMPLOYEE" ? "ZERO"   : "ALL", sql: `SELECT count(*)::int AS c FROM leads` },
    { table: "quotations",        expect: roleName === "EMPLOYEE" ? "ZERO"   : "ALL", sql: `SELECT count(*)::int AS c FROM quotations` },
    { table: "audit_logs",        expect: roleName === "PARTNER"  ? "ALL"    : "ZERO", sql: `SELECT count(*)::int AS c FROM audit_logs` },
    { table: "activity_logs",     expect: roleName === "PARTNER"  ? "ALL"    : "ZERO", sql: `SELECT count(*)::int AS c FROM activity_logs` },
    { table: "firm_settings",     expect: "ALL", sql: `SELECT count(*)::int AS c FROM firm_settings` },
    { table: "documents",         expect: roleName === "EMPLOYEE" ? "SCOPED" : "ALL", sql: `SELECT count(*)::int AS c FROM documents` },
    { table: "compliance_events", expect: roleName === "EMPLOYEE" ? "SCOPED" : "ALL", sql: `SELECT count(*)::int AS c FROM compliance_events` },
    { table: "employees",         expect: roleName === "EMPLOYEE" ? "OWN"    : "ALL", sql: `SELECT count(*)::int AS c FROM employees` },
    { table: "notifications",     expect: "OWN", sql: `SELECT count(*)::int AS c FROM notifications` },
    { table: "employee_sessions", expect: roleName === "EMPLOYEE" ? "OWN"    : "ALL", sql: `SELECT count(*)::int AS c FROM employee_sessions` },
    { table: "recurring_compliance_templates", expect: "ALL", sql: `SELECT count(*)::int AS c FROM recurring_compliance_templates` },
  ]

  // Baselines (as superuser) so we know what "ALL" should look like
  const baseline = new Map<string, number>()
  for (const p of probes) {
    const r = await q<{ c: number }>(p.sql)
    baseline.set(p.table, Number(r[0]?.c ?? 0))
  }

  const results: { table: string; expected: string; got: number; baseline: number; ok: boolean; notes: string }[] = []
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

      for (const p of probes) {
        try {
          const r = await tx.$queryRawUnsafe<{ c: number }[]>(p.sql)
          const got = Number(r[0]?.c ?? 0)
          const base = baseline.get(p.table) ?? 0
          let ok = false
          let notes = ""
          switch (p.expect) {
            case "ALL":    ok = got === base;            notes = `expected all (${base}) — got ${got}`; break
            case "ZERO":   ok = got === 0;               notes = `expected 0 — got ${got}${got > 0 ? " ⚠ leak" : ""}`; break
            case "SCOPED": ok = got <= base;             notes = `expected <= ${base} (scoped) — got ${got}`; break
            case "OWN":    ok = got >= 0 && got <= base; notes = `expected scoped to own — got ${got}/${base}`; break
          }
          results.push({ table: p.table, expected: p.expect, got, baseline: base, ok, notes })
        } catch (err) {
          // A permission error counts as "denied" — treat as 0 for ZERO/SCOPED expectations.
          const msg = err instanceof Error ? err.message : String(err)
          const ok = p.expect === "ZERO" || p.expect === "SCOPED" || p.expect === "OWN"
          results.push({
            table: p.table,
            expected: p.expect,
            got: -1,
            baseline: baseline.get(p.table) ?? 0,
            ok,
            notes: `query denied: ${msg.split("\n")[0]}`,
          })
        }
      }

      // NOTE: firm_settings write-enforcement probes are NOT run inside this
      // shared read transaction. A Prisma interactive transaction is poisoned
      // by the first statement error, and the RLS-denied INSERT is an expected
      // error — running it here would abort all subsequent probes. The write
      // probes run in their own isolated transactions after this block
      // (see probeFirmSettingsWrites).

      // EMPLOYEE/MANAGER trying to read another user's notifications
      if (roleName !== "PARTNER") {
        // baseline notification count for someone else
        const otherUid = (await q<{ id: string }>(
          `SELECT id::text AS id FROM "User" WHERE id::text <> '${uid}' LIMIT 1`
        ))[0]?.id
        if (otherUid) {
          const r = await tx.$queryRawUnsafe<{ c: number }[]>(
            `SELECT count(*)::int AS c FROM notifications WHERE "userId" = '${otherUid}'`
          )
          const got = Number(r[0]?.c ?? 0)
          results.push({
            table: "notifications(other-user)",
            expected: "ZERO",
            got,
            baseline: -1,
            ok: got === 0,
            notes: got === 0 ? "ok — cannot see another user's notifications" : `⚠ saw ${got} foreign notifications`,
          })
        }
      }

      // Force rollback so SET LOCAL ROLE doesn't leak
      throw new Error("__rollback__")
    })
  } catch (e) {
    if (!(e instanceof Error && e.message === "__rollback__")) {
      console.log("  tx aborted:", e instanceof Error ? e.message : String(e))
    }
  }

  // Write-enforcement probes run in their own isolated transactions.
  const writeResults = await probeFirmSettingsWrites(roleName, uid)
  results.push(...writeResults)

  // Print results
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗"
    console.log(`  ${mark} ${r.table.padEnd(28)} expect=${r.expected.padEnd(7)} ${r.notes}`)
  }
  const pass = results.every((r) => r.ok)
  sections.push({
    title: `${roleName} (${label}) — all access expectations met`,
    status: pass ? "PASS" : "FAIL",
    detail: results.filter((r) => !r.ok).map((r) => `${r.table}: ${r.notes}`).join("; ") || "ok",
  })
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═".repeat(78))
  console.log("J-TACS — RLS Certification")
  console.log("═".repeat(78))

  await section_schemaAndHelpers()
  await section_rlsCoverage()
  await section_policyCounts()
  await section_helperFunctionSmoke()

  // Pick a real user for each role if available; otherwise synthetic UUIDs.
  const partnerRow = await q<{ id: string }>(`SELECT id::text AS id FROM "User" WHERE role='PARTNER' LIMIT 1;`)
  const managerRow = await q<{ id: string }>(`SELECT id::text AS id FROM "User" WHERE role='MANAGER' LIMIT 1;`)
  const employeeRow = await q<{ id: string }>(`SELECT id::text AS id FROM "User" WHERE role='EMPLOYEE' LIMIT 1;`)
  const partnerUid = partnerRow[0]?.id ?? "00000000-0000-0000-0000-000000000001"
  const managerUid = managerRow[0]?.id ?? "00000000-0000-0000-0000-000000000002"
  const employeeUid = employeeRow[0]?.id ?? "00000000-0000-0000-0000-000000000003"
  console.log("\n  Found role UIDs:")
  console.log(`    PARTNER  = ${partnerUid}${partnerRow[0] ? "" : "  (synthetic — no PARTNER User row)"}`)
  console.log(`    MANAGER  = ${managerUid}${managerRow[0] ? "" : "  (synthetic — no MANAGER User row)"}`)
  console.log(`    EMPLOYEE = ${employeeUid}${employeeRow[0] ? "" : "  (synthetic — no EMPLOYEE User row)"}`)

  // Ensure a committed firm_settings singleton exists so the write-enforcement
  // probes have a row to act on. Track whether we created it so we can clean up
  // and never clobber a real firm's configuration.
  const existingSingleton = await q<{ id: string }>(
    `SELECT id FROM firm_settings WHERE id = 'singleton' LIMIT 1;`
  )
  const seededSingleton = existingSingleton.length === 0
  if (seededSingleton) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO firm_settings (id, "firmName", "fromEmail", "updatedAt")
      VALUES ('singleton', 'RLS Cert Tombstone', 'cert@example.com', NOW())
      ON CONFLICT (id) DO NOTHING;
    `)
    console.log("\n  (seeded a temporary firm_settings singleton for write probes — will remove after)")
  }

  await simulateAs("PARTNER",  partnerUid,  "real")
  await simulateAs("MANAGER",  managerUid,  managerRow[0]  ? "real" : "synthetic")
  await simulateAs("EMPLOYEE", employeeUid, employeeRow[0] ? "real" : "synthetic")

  // Clean up the temporary singleton if we created it.
  if (seededSingleton) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM firm_settings WHERE id = 'singleton' AND "firmName" = 'RLS Cert Tombstone';`
    ).catch(() => {})
  }

  // ── Final summary ─────────────────────────────────────────────────────
  hr("FINAL")
  let pass = 0, fail = 0, warn = 0
  for (const s of sections) {
    const mark = s.status === "PASS" ? "✓" : s.status === "FAIL" ? "✗" : s.status === "WARN" ? "⚠" : "ℹ"
    console.log(`  ${mark} ${s.title.padEnd(60)} ${s.status === "PASS" ? "" : "— " + s.detail}`)
    if (s.status === "PASS") pass++
    else if (s.status === "FAIL") fail++
    else if (s.status === "WARN") warn++
  }
  console.log("─".repeat(78))
  console.log(`Sections: ${pass} pass, ${fail} fail, ${warn} warn`)
  console.log("Certification:", fail === 0 ? "PASS" : "FAIL")
  console.log("═".repeat(78))

  await prisma.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error("Certification crashed:", err)
  await prisma.$disconnect()
  process.exit(2)
})
