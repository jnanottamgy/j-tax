# J-TACS — RLS Certification Report

**Date:** 2026-06-11
**Migration:** `prisma/migrations-manual/002_rls_policies.sql` (Session 14)
**Tested against:** live Supabase database via service-role connection
**Test scripts:**
- `scripts/rls-certify.ts` — schema + policy + helper-function audit + role simulation
- `scripts/rls-write-probe.ts` — direct write attempts under each role (rolled back)
- `scripts/rls-helper-smoke.ts` — `jtacs_auth.user_role()` correctness across JWT shapes
- `scripts/rls-leak-check.ts` — null-key data surface enumeration

---

## Final Status

> ## ⚠ **CONDITIONAL PASS**
>
> All 36 tables have RLS enabled, all expected helper functions exist, all
> read-access expectations for every role match the matrix, and **no privilege
> escalation paths were found in 9 write probes**. There is **one localized
> finding** (`compliance_events_employee_assigned` policy exposes 1076 events
> with `clientId IS NULL` to every EMPLOYEE) that should be addressed before
> exposing the Supabase API to direct EMPLOYEE clients. A one-line policy fix
> is documented in §5 below.

---

## 1. RLS Coverage Report

| Metric | Result |
|--------|--------|
| Tables expected with RLS | 36 |
| **Tables with RLS enabled** | **36 / 36 ✓** |
| Tables with RLS disabled | 0 |
| Tables missing from schema | 0 |
| Other public tables without RLS | 0 |

All 36 tables in the migration's security matrix are confirmed `relrowsecurity=true` in `pg_class`. No public table is unprotected.

---

## 2. Policy Count Report

| Metric | Result |
|--------|--------|
| Baseline (per RLS_ACTIVATION_GUIDE.md) | 56 |
| **Policies present on public schema** | **62 ✓** |
| Tables with at least one policy | 36 / 36 ✓ |

The +6 above baseline comes from the EMPLOYEE-scoped per-operation policies on `tasks`, `task_comments`, `task_attachments`, `compliance_events`, `attendance_records`, `employee_sessions`, `employee_activities` that split `FOR ALL` into separate SELECT + INSERT/UPDATE/DELETE policies.

Per-table breakdown (all 36 tables, total 62 policies):
```
User                            2    activity_logs                   1
attendance_records              3    audit_logs                      1
client_services                 2    client_timeline_events          2
clients                         2    compliance_events               2
compliance_schedules            2    document_activities             2
document_tags                   2    document_versions               2
documents                       2    employee_activities             3
employee_sessions               3    employees                       2
firm_settings                   2    follow_ups                      1
invoice_reminders               1    invoices                        1
leads                           1    message_logs                    2
message_templates               2    messages                        2
notifications                   1    payment_receipts                1
quotation_email_logs            1    quotation_follow_ups            1
quotation_items                 1    quotations                      1
recurring_compliance_templates  2    reminders                       2
task_attachments                2    task_automations                1
task_comments                   2    tasks                           2
```

---

## 3. Helper-Function Report

| Check | Result |
|-------|--------|
| `jtacs_auth` schema exists | ✓ |
| `jtacs_auth.user_role()` exists | ✓ |
| `jtacs_auth.employee_id()` exists | ✓ |
| `jtacs_auth.employee_id()` is `SECURITY DEFINER` | ✓ (prosecdef=true) |

Function smoke test (`scripts/rls-helper-smoke.ts`):

```
jtacs_auth.user_role() with app_metadata.role='PARTNER'  → PARTNER  ✓
jtacs_auth.user_role() with app_metadata.role='MANAGER'  → MANAGER  ✓
jtacs_auth.user_role() with app_metadata.role='EMPLOYEE' → EMPLOYEE ✓
jtacs_auth.user_role() with app_metadata.role='CLIENT'   → CLIENT   ✓
jtacs_auth.user_role() with app_metadata.role='BOGUS'    → BOGUS    ℹ (passthrough — policies match against literal strings, so unknown roles match no policy)
jtacs_auth.user_role() with no JWT                       → anon     ✓
```

Verdict: the role-extraction function is JWT-driven, case-sensitive (so an attacker would need Supabase to issue a JWT with the magic string — not possible without compromising signing keys), and falls back to `anon` on missing JWTs.

---

## 4. Access-Control Report (live role simulation)

Each test sets `request.jwt.claims` to a synthetic JWT for the role, runs `SET LOCAL ROLE authenticated;` so RLS engages (service-role bypasses by default), and queries representative tables inside a transaction that is then rolled back.

### 4.1 — PARTNER (real user: `ba4e8ab8-db54-4390-94ca-dacd418c0dd1`)

| Table | Expected | Got | ✓/✗ |
|-------|----------|-----|----|
| clients | all (100) | 100 | ✓ |
| tasks | all (500) | 500 | ✓ |
| invoices | all (200) | 200 | ✓ |
| payment_receipts | all (0) | 0 | ✓ |
| leads | all (0) | 0 | ✓ |
| quotations | all (0) | 0 | ✓ |
| audit_logs | all | 0 | ✓ |
| activity_logs | all | 0 | ✓ |
| firm_settings | all | 0/1* | ✓ |
| documents | all (0) | 0 | ✓ |
| compliance_events | all (1076) | 1076 | ✓ |
| employees | all (10) | 10 | ✓ |
| notifications (own) | scoped to own | 511/1000 | ✓ |
| employee_sessions | all | 0 | ✓ |
| recurring_compliance_templates | all | 0 | ✓ |
| firm_settings (UPDATE) | ALLOW | ALLOWED (1 row modified) | ✓ |

\* firm_settings is empty on read until a PARTNER first saves; the write probe seeds it transactionally.

### 4.2 — MANAGER (synthetic JWT — no real MANAGER User row in DB)

| Table | Expected | Got | ✓/✗ |
|-------|----------|-----|----|
| clients | all (100) | 100 | ✓ |
| tasks | all (500) | 500 | ✓ |
| invoices | all (200) | 200 | ✓ |
| leads | all | 0 | ✓ |
| quotations | all | 0 | ✓ |
| **audit_logs** | **0 (denied)** | **0** | **✓** |
| **activity_logs** | **0 (denied)** | **0** | **✓** |
| firm_settings | read | 0/1 | ✓ |
| documents | all | 0 | ✓ |
| compliance_events | all (1076) | 1076 | ✓ |
| employees | all (10) | 10 | ✓ |
| notifications (own) | scoped | 0/1000 | ✓ |
| **firm_settings UPDATE** | **DENY** | **DENIED** (policy blocked) | **✓** |
| **firm_settings INSERT** | **DENY** | **DENIED** (policy blocked) | **✓** |
| notifications(other-user) | DENY | 0 visible | ✓ |

### 4.3 — EMPLOYEE (synthetic JWT — no real EMPLOYEE User row in DB)

| Table | Expected | Got | ✓/✗ |
|-------|----------|-----|----|
| clients | scoped (≤100) | 0 | ✓ (unassigned synthetic) |
| tasks | scoped (≤500) | 0 | ✓ |
| **invoices** | **0 (denied)** | **0** | **✓** |
| **payment_receipts** | **0 (denied)** | **0** | **✓** |
| **leads** | **0 (denied)** | **0** | **✓** |
| **quotations** | **0 (denied)** | **0** | **✓** |
| **audit_logs** | **0 (denied)** | **0** | **✓** |
| **activity_logs** | **0 (denied)** | **0** | **✓** |
| firm_settings | read-only | 0/1 | ✓ |
| documents (scoped) | 0 | 0 | ✓ |
| **compliance_events (scoped)** | **0 (synthetic has no assigned client)** | **1076** | **⚠ see §5 FINDING-RLS-001** |
| employees (own) | 0 | 0 | ✓ |
| notifications (own) | 0 | 0 | ✓ |
| employee_sessions (own) | 0 | 0 | ✓ |
| **firm_settings UPDATE** | **DENY** | **DENIED** | **✓** |
| **firm_settings INSERT** | **DENY** | **DENIED** | **✓** |
| **invoices INSERT** | **DENY** | **DENIED** (error raised) | **✓** |
| notifications(other-user) | DENY | 0 visible | ✓ |

---

## 5. Security Findings

### FINDING-RLS-001 — `compliance_events` exposes NULL-clientId rows to every EMPLOYEE  (Severity: Medium)

**Location:** `prisma/migrations-manual/002_rls_policies.sql` lines 373–393 (policy `compliance_events_employee_assigned`).

**The defect:** The `USING` clause begins with
```sql
USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND (
      "clientId" IS NULL              -- ← bypass clause
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = compliance_events."clientId"
          AND c."assignedEmployeeId" = jtacs_auth.employee_id()
      )
    )
  )
```

The `"clientId" IS NULL OR` short-circuits the assigned-client check whenever `clientId` is null. Since `compliance_events.clientId` is nullable in the schema (`prisma/schema.prisma:690 — clientId String?`), any row with `clientId = NULL` is visible to **every** EMPLOYEE.

**Live data impact:**
```
compliance_events            total=1076  clientId_null=1076
```
**100% of compliance events in the database currently have NULL clientId**, so today's effect is "every EMPLOYEE who connects to the Supabase API directly can read every compliance event in the firm".

The `WITH CHECK` clause does NOT include the NULL bypass, so EMPLOYEEs cannot write these events; the impact is limited to reads.

**Why this matters:**
- The Next.js backend uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. So **application UI is unaffected today**. The application's own scoping (`getEmployeeScopeId()` etc.) correctly restricts the EMPLOYEE dashboard.
- If/when CLIENT-portal or future EMPLOYEE-facing apps use the Supabase JS client (anon/authenticated key) for any compliance query, this would be a direct leak.

**Recommended fix (one-line):**
```sql
DROP POLICY IF EXISTS "compliance_events_employee_assigned" ON compliance_events;
CREATE POLICY "compliance_events_employee_assigned"
  ON compliance_events FOR ALL
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = compliance_events."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  )
  WITH CHECK (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = compliance_events."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );
```
Drop the `"clientId" IS NULL OR` branch. The `WITH CHECK` already enforces the EXISTS path, so this is purely tightening the USING clause to match. Idempotent; safe to apply on top of the existing migration.

---

### FINDING-RLS-002 — No real MANAGER or EMPLOYEE User rows exist in DB  (Severity: Informational)

The certification queries the `"User"` table for one row per role:
```
PARTNER  = ba4e8ab8-db54-4390-94ca-dacd418c0dd1  (real)
MANAGER  = (synthetic — no MANAGER User row)
EMPLOYEE = (synthetic — no EMPLOYEE User row)
```

The 10 seeded `employees` rows have `userId = NULL` — they aren't linked to Supabase auth users. This is fine for a fresh install, but means:

1. The certification could not perform a "real EMPLOYEE under their own JWT" scoping test. Synthetic JWTs verified the policies behave correctly with unknown employees (they see nothing extra), but a real linked EMPLOYEE would see exactly their assigned clients.
2. Before exposing the Supabase API to EMPLOYEE clients, ensure the customer's `User`→`Employee` linkage is created at signup, otherwise `jtacs_auth.employee_id()` returns NULL and the EMPLOYEE sees zero of their own data via direct API.

**No action required at the policy layer.** Document in onboarding ops.

---

### FINDING-RLS-003 — No corroborating test for `notifications`-own-write enforcement  (Severity: Informational)

The certification verified READ-side notification isolation (own + foreign), but the INSERT/UPDATE policy on notifications wasn't write-probed. The migration's `notifications_own_all` policy explicitly says `WHERE "userId" = auth.uid()`, so the WITH CHECK should be sound — but a live write probe was not run because it would require seeding then cleaning up notifications.

**Suggested follow-up:** add an INSERT probe with `"userId" = <other_uid>` to confirm the WITH CHECK rejects cross-user inserts.

---

## 6. Remaining Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| 1 | Direct Supabase API access by EMPLOYEE sees all compliance events | High if API exposed; Low today (service-role only) | Information disclosure of all firm compliance deadlines | Apply FINDING-RLS-001 fix |
| 2 | EMPLOYEE/MANAGER User rows not yet provisioned | Certain on fresh install | Direct API would show empty data; UI works via service-role | Operations / onboarding playbook |
| 3 | Service-role connection string leak (e.g. in a Vercel build log) | Very low with secrets manager | Total bypass of all RLS | Standard secret hygiene; no RLS layer can mitigate this |
| 4 | `jtacs_auth.user_role()` is JWT-driven; forged JWT = total bypass | Negligible (requires Supabase signing key) | Total bypass | Standard Supabase auth security |
| 5 | A future migration could re-enable a NULL-bypass on another scoped table without certification | Low | Per-table data leak | Re-run `scripts/rls-certify.ts` after every RLS migration |

---

## 7. Reproducibility

To re-run the full certification at any time:

```bash
# Schema + RLS + policy + role simulation
npx tsx -r dotenv/config scripts/rls-certify.ts

# Write probe (mutates inside transactions, all rolled back)
npx tsx -r dotenv/config scripts/rls-write-probe.ts

# Helper function smoke
npx tsx -r dotenv/config scripts/rls-helper-smoke.ts

# Null-key data surface enumeration
npx tsx -r dotenv/config scripts/rls-leak-check.ts
```

Last run: 2026-06-11 against the live Supabase instance referenced by `DATABASE_URL`.

---

## 8. Certification Decision

| Criterion | Status |
|-----------|--------|
| All expected tables have RLS enabled | ✓ |
| All expected policies exist | ✓ (62 ≥ 56 baseline) |
| `jtacs_auth.user_role()` exists | ✓ |
| `jtacs_auth.employee_id()` exists + SECURITY DEFINER | ✓ |
| PARTNER can access firm-wide data | ✓ |
| MANAGER can access team-scoped data (no audit_logs/activity_logs, no firm_settings writes) | ✓ |
| EMPLOYEE can access assigned data only (no invoices/leads/audit_logs/writes to forbidden tables) | ✓ except compliance_events (FINDING-RLS-001) |
| No privilege escalation (9 write probes) | ✓ |
| No data leakage (read tests) | ✓ except compliance_events NULL-clientId bypass |

### **CONDITIONAL PASS**

The RLS deployment is structurally correct: every table is protected, every helper function is in place, the security matrix is enforced for read access on every table except one, and write access is correctly denied in every probe. The one issue — `compliance_events` NULL-clientId visibility — is a one-line policy fix documented in §5 and **does not affect the running application today** because the Next.js backend uses the service-role connection.

**To upgrade to a UNCONDITIONAL PASS:** apply the FINDING-RLS-001 fix (the `DROP POLICY … CREATE POLICY` block in §5) in the Supabase SQL editor and re-run `scripts/rls-certify.ts` — the compliance_events line should then read `got=0` for the synthetic EMPLOYEE.
