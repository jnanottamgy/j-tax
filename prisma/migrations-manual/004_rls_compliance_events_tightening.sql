-- ────────────────────────────────────────────────────────────────────────────
-- 004_rls_compliance_events_tightening.sql
-- Fixes FINDING-RLS-001 (J-TACS RLS_CERTIFICATION.md, 2026-06-11):
--   The compliance_events_employee_assigned policy previously contained
--   `"clientId" IS NULL OR …` which exposed every NULL-clientId compliance
--   event to every EMPLOYEE via direct API access. Live data showed 100% of
--   rows (1076/1076) had NULL clientId, so this was a full data leak.
--
-- Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

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

-- Verification:
-- After applying, running scripts/rls-certify.ts under a synthetic EMPLOYEE
-- JWT should report `compliance_events: got=0` instead of `got=1076`.

COMMIT;
