-- ═══════════════════════════════════════════════════════════════════════════════
-- J-TACS — Complete Row-Level Security (RLS) Migration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Coverage  : ALL 36 public tables
-- Roles     : PARTNER (full), MANAGER (near-full), EMPLOYEE (scoped), CLIENT (none)
-- Idempotent: Safe to re-run — drops all existing policies before re-creating.
--
-- Prerequisites:
--   1. Run in the Supabase SQL editor as the postgres superuser.
--   2. Migration 001 (EXECUTIVE → EMPLOYEE rename) must already be applied.
--   3. The Next.js backend uses the service-role key, which bypasses RLS
--      automatically — these policies protect direct API / PostgREST access.
--
-- NOTE: Helper functions live in the "jtacs_auth" schema (NOT the Supabase "auth"
--       schema, which is read-only). They call auth.jwt() and auth.uid() from the
--       Supabase auth schema, which are available to all schemas.
--
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- SECURITY MATRIX (36 tables)
-- ──────────────────────────────────────────────────────────────────────────────
-- Table                          │ PARTNER   │ MANAGER   │ EMPLOYEE
-- ───────────────────────────────┼───────────┼───────────┼──────────────────────
-- firm_settings                  │ ALL       │ SELECT    │ SELECT
-- "User"                         │ ALL       │ SELECT    │ SELECT
-- employees                      │ ALL       │ ALL       │ SELECT (own record)
-- clients                        │ ALL       │ ALL       │ SELECT (assigned)
-- client_services                │ ALL       │ ALL       │ SELECT (assigned client)
-- tasks                          │ ALL       │ ALL       │ ALL (assigned to me)
-- task_comments                  │ ALL       │ ALL       │ ALL (assigned task)
-- task_attachments               │ ALL       │ ALL       │ ALL (assigned task)
-- task_automations               │ ALL       │ ALL       │ —
-- compliance_schedules           │ ALL       │ ALL       │ SELECT (assigned client)
-- compliance_events              │ ALL       │ ALL       │ ALL (assigned client)
-- documents                      │ ALL       │ ALL       │ SELECT (assigned client)
-- document_versions              │ ALL       │ ALL       │ SELECT (assigned client)
-- document_tags                  │ ALL       │ ALL       │ SELECT (assigned client)
-- document_activities            │ ALL       │ ALL       │ SELECT (assigned client)
-- message_templates              │ ALL       │ ALL       │ SELECT
-- messages                       │ ALL       │ ALL       │ SELECT (assigned client)
-- message_logs                   │ ALL       │ ALL       │ SELECT (assigned client)
-- invoices                       │ ALL       │ ALL       │ —
-- payment_receipts               │ ALL       │ ALL       │ —
-- follow_ups                     │ ALL       │ ALL       │ —
-- invoice_reminders              │ ALL       │ ALL       │ —
-- activity_logs                  │ ALL       │ —         │ —
-- audit_logs                     │ ALL       │ —         │ —
-- notifications                  │ ALL (own) │ ALL (own) │ ALL (own)
-- reminders                      │ ALL       │ ALL       │ SELECT (assigned client)
-- employee_sessions              │ ALL       │ SELECT    │ SELECT (own)
-- employee_activities            │ ALL       │ SELECT    │ SELECT (own)
-- attendance_records             │ ALL       │ SELECT    │ SELECT (own)
-- leads                          │ ALL       │ ALL       │ —
-- quotations                     │ ALL       │ ALL       │ —
-- quotation_items                │ ALL       │ ALL       │ —
-- quotation_email_logs           │ ALL       │ ALL       │ —
-- quotation_follow_ups           │ ALL       │ ALL       │ —
-- client_timeline_events         │ ALL       │ ALL       │ SELECT (assigned client)
-- recurring_compliance_templates │ ALL       │ SELECT    │ SELECT
-- ──────────────────────────────────────────────────────────────────────────────
--
-- "—" = no policy → RLS denies all access for that role.
-- "ALL" = SELECT + INSERT + UPDATE + DELETE.
-- "ALL (own)" = all operations but only on rows belonging to the caller.
-- "SELECT (assigned client)" = read-only, scoped via client → assignedEmployeeId.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: DEDICATED SCHEMA + HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create dedicated schema for J-TACS auth helpers (Supabase's "auth" schema is
-- read-only — custom functions cannot be created there).
CREATE SCHEMA IF NOT EXISTS jtacs_auth;

-- Grant usage so all roles can call these functions from within RLS policies.
GRANT USAGE ON SCHEMA jtacs_auth TO postgres, anon, authenticated, service_role;

-- Extract role from JWT (app_metadata.role → top-level role claim → 'anon').
-- Calls Supabase's built-in auth.jwt() which is accessible from any schema.
CREATE OR REPLACE FUNCTION jtacs_auth.user_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'role',
    'anon'
  );
$$;

-- Extract Employee.id for the current auth user.
-- SECURITY DEFINER: runs as postgres to bypass RLS on employees table,
-- ensuring the lookup always succeeds regardless of caller's permissions.
-- Calls Supabase's built-in auth.uid() which is accessible from any schema.
CREATE OR REPLACE FUNCTION jtacs_auth.employee_id()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM employees
  WHERE "userId" = auth.uid()::text
    AND "isActive" = true
  LIMIT 1;
$$;

-- Grant execute to roles that will trigger these via RLS policies.
GRANT EXECUTE ON FUNCTION jtacs_auth.user_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION jtacs_auth.employee_id() TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: ENABLE RLS ON ALL 36 TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE firm_settings                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_services                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_automations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_schedules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_activities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates              ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_reminders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sessions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_activities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_email_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_follow_ups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_timeline_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_compliance_templates ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: DROP ALL EXISTING POLICIES (idempotency)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _pol RECORD;
BEGIN
  FOR _pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      _pol.policyname, _pol.schemaname, _pol.tablename);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4: CREATE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. firm_settings — PARTNER write; MANAGER/EMPLOYEE read-only
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "firm_settings_partner_all"
  ON firm_settings FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

CREATE POLICY "firm_settings_staff_read"
  ON firm_settings FOR SELECT
  USING (jtacs_auth.user_role() IN ('MANAGER', 'EMPLOYEE'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. "User" — PARTNER full; MANAGER/EMPLOYEE read-only
--    (User records are created by the service role; direct writes are PARTNER-only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "user_partner_all"
  ON "User" FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

CREATE POLICY "user_staff_read"
  ON "User" FOR SELECT
  USING (jtacs_auth.user_role() IN ('MANAGER', 'EMPLOYEE'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. employees — PARTNER/MANAGER full; EMPLOYEE read own record only
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "employees_partner_manager_all"
  ON employees FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "employees_self_read"
  ON employees FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND "userId" = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. clients — PARTNER/MANAGER full; EMPLOYEE read assigned only
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "clients_partner_manager_all"
  ON clients FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "clients_employee_read"
  ON clients FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND "assignedEmployeeId" = jtacs_auth.employee_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. client_services — follows client access pattern
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "client_services_partner_manager_all"
  ON client_services FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "client_services_employee_read"
  ON client_services FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_services."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. tasks — PARTNER/MANAGER full; EMPLOYEE full on assigned tasks
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "tasks_partner_manager_all"
  ON tasks FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "tasks_employee_assigned"
  ON tasks FOR ALL
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND "assignedEmployeeId" = jtacs_auth.employee_id()
  )
  WITH CHECK (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND "assignedEmployeeId" = jtacs_auth.employee_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. task_comments — follows task access (via task → assignedEmployeeId)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "task_comments_partner_manager_all"
  ON task_comments FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "task_comments_employee_assigned"
  ON task_comments FOR ALL
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments."taskId"
        AND t."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  )
  WITH CHECK (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments."taskId"
        AND t."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. task_attachments — follows task access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "task_attachments_partner_manager_all"
  ON task_attachments FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "task_attachments_employee_assigned"
  ON task_attachments FOR ALL
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_attachments."taskId"
        AND t."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  )
  WITH CHECK (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_attachments."taskId"
        AND t."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. task_automations — PARTNER/MANAGER only (EMPLOYEE cannot manage automations)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "task_automations_partner_manager_all"
  ON task_automations FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. compliance_schedules — follows client access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "compliance_schedules_partner_manager_all"
  ON compliance_schedules FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "compliance_schedules_employee_read"
  ON compliance_schedules FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = compliance_schedules."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. compliance_events — PARTNER/MANAGER full; EMPLOYEE full on assigned client
--     (EMPLOYEE can update workflow status per SIM-004 fix)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "compliance_events_partner_manager_all"
  ON compliance_events FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- Tightened 2026-06-11 (FINDING-RLS-001): removed `"clientId" IS NULL OR`
-- bypass that exposed orphaned compliance events to every EMPLOYEE.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. documents — PARTNER/MANAGER full; EMPLOYEE read for assigned clients
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "documents_partner_manager_all"
  ON documents FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "documents_employee_read"
  ON documents FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = documents."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. document_versions — follows document → client access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "document_versions_partner_manager_all"
  ON document_versions FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "document_versions_employee_read"
  ON document_versions FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM documents d
        INNER JOIN clients c ON c.id = d."clientId"
      WHERE d.id = document_versions."documentId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. document_tags — follows document → client access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "document_tags_partner_manager_all"
  ON document_tags FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "document_tags_employee_read"
  ON document_tags FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM documents d
        INNER JOIN clients c ON c.id = d."clientId"
      WHERE d.id = document_tags."documentId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. document_activities — follows document → client access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "document_activities_partner_manager_all"
  ON document_activities FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "document_activities_employee_read"
  ON document_activities FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM documents d
        INNER JOIN clients c ON c.id = d."clientId"
      WHERE d.id = document_activities."documentId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. message_templates — PARTNER/MANAGER full; EMPLOYEE read-only
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "message_templates_partner_manager_all"
  ON message_templates FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "message_templates_employee_read"
  ON message_templates FOR SELECT
  USING (jtacs_auth.user_role() = 'EMPLOYEE');

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. messages — PARTNER/MANAGER full; EMPLOYEE read for assigned clients
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "messages_partner_manager_all"
  ON messages FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "messages_employee_read"
  ON messages FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = messages."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. message_logs — follows message → client access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "message_logs_partner_manager_all"
  ON message_logs FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "message_logs_employee_read"
  ON message_logs FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM messages m
        INNER JOIN clients c ON c.id = m."clientId"
      WHERE m.id = message_logs."messageId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. invoices — PARTNER/MANAGER only (EMPLOYEE has no invoice access)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "invoices_partner_manager_all"
  ON invoices FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. payment_receipts — follows invoice access (PARTNER/MANAGER only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "payment_receipts_partner_manager_all"
  ON payment_receipts FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. follow_ups — follows invoice access (PARTNER/MANAGER only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "follow_ups_partner_manager_all"
  ON follow_ups FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. invoice_reminders — follows invoice access (PARTNER/MANAGER only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "invoice_reminders_partner_manager_all"
  ON invoice_reminders FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 23. activity_logs — PARTNER only (firm-wide security audit trail)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "activity_logs_partner_all"
  ON activity_logs FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

-- ─────────────────────────────────────────────────────────────────────────────
-- 24. audit_logs — PARTNER only (security/auth event log)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "audit_logs_partner_all"
  ON audit_logs FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

-- ─────────────────────────────────────────────────────────────────────────────
-- 25. notifications — each user can only access their own
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "notifications_own_all"
  ON notifications FOR ALL
  USING (
    jtacs_auth.user_role() IN ('PARTNER', 'MANAGER', 'EMPLOYEE')
    AND "userId" = auth.uid()::text
  )
  WITH CHECK (
    jtacs_auth.user_role() IN ('PARTNER', 'MANAGER', 'EMPLOYEE')
    AND "userId" = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 26. reminders — follows client access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "reminders_partner_manager_all"
  ON reminders FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "reminders_employee_read"
  ON reminders FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = reminders."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 27. employee_sessions — Workforce (PARTNER full; MANAGER read; EMPLOYEE own)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "employee_sessions_partner_all"
  ON employee_sessions FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

CREATE POLICY "employee_sessions_manager_read"
  ON employee_sessions FOR SELECT
  USING (jtacs_auth.user_role() = 'MANAGER');

CREATE POLICY "employee_sessions_self_read"
  ON employee_sessions FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND "employeeId" = jtacs_auth.employee_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 28. employee_activities — Workforce (same pattern)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "employee_activities_partner_all"
  ON employee_activities FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

CREATE POLICY "employee_activities_manager_read"
  ON employee_activities FOR SELECT
  USING (jtacs_auth.user_role() = 'MANAGER');

CREATE POLICY "employee_activities_self_read"
  ON employee_activities FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND "employeeId" = jtacs_auth.employee_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 29. attendance_records — Workforce (same pattern)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "attendance_records_partner_all"
  ON attendance_records FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

CREATE POLICY "attendance_records_manager_read"
  ON attendance_records FOR SELECT
  USING (jtacs_auth.user_role() = 'MANAGER');

CREATE POLICY "attendance_records_self_read"
  ON attendance_records FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND "employeeId" = jtacs_auth.employee_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 30. leads — Proposals module (PARTNER/MANAGER only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "leads_partner_manager_all"
  ON leads FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 31. quotations — Proposals module (PARTNER/MANAGER only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "quotations_partner_manager_all"
  ON quotations FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 32. quotation_items — follows quotation access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "quotation_items_partner_manager_all"
  ON quotation_items FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 33. quotation_email_logs — follows quotation access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "quotation_email_logs_partner_manager_all"
  ON quotation_email_logs FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 34. quotation_follow_ups — follows quotation access
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "quotation_follow_ups_partner_manager_all"
  ON quotation_follow_ups FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 35. client_timeline_events — follows client access
--     (clientId is nullable; leadId may be set instead for pre-conversion leads)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "client_timeline_events_partner_manager_all"
  ON client_timeline_events FOR ALL
  USING  (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (jtacs_auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "client_timeline_events_employee_read"
  ON client_timeline_events FOR SELECT
  USING (
    jtacs_auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_timeline_events."clientId"
        AND c."assignedEmployeeId" = jtacs_auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 36. recurring_compliance_templates — PARTNER full; MANAGER/EMPLOYEE read-only
--     (System configuration data — only PARTNER should modify templates)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "recurring_compliance_templates_partner_all"
  ON recurring_compliance_templates FOR ALL
  USING  (jtacs_auth.user_role() = 'PARTNER')
  WITH CHECK (jtacs_auth.user_role() = 'PARTNER');

CREATE POLICY "recurring_compliance_templates_staff_read"
  ON recurring_compliance_templates FOR SELECT
  USING (jtacs_auth.user_role() IN ('MANAGER', 'EMPLOYEE'));

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 5: VALIDATION (run after COMMIT — these are SELECT-only)
-- ═══════════════════════════════════════════════════════════════════════════════

-- 5a. Confirm RLS is enabled on all 36 public tables
--     Expected: 36 rows, all with rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE '_prisma%'
ORDER BY tablename;

-- 5b. Count of RLS-enabled tables (should be 36)
SELECT count(*) AS tables_with_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename NOT LIKE '_prisma%';

-- 5c. List all policies with details (should be 56 policies)
SELECT tablename, policyname, cmd, permissive,
       qual IS NOT NULL AS has_using,
       with_check IS NOT NULL AS has_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 5d. Policy count per table
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 5e. Total policy count (should be 56)
SELECT count(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public';

-- 5f. Tables WITHOUT RLS (should return 0 rows, excluding _prisma tables)
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT LIKE '_prisma%'
ORDER BY tablename;

-- 5g. Confirm helper functions exist in jtacs_auth schema
SELECT routine_schema, routine_name, data_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'jtacs_auth'
ORDER BY routine_name;

-- 5h. Confirm jtacs_auth schema exists
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'jtacs_auth';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 6: ROLE SIMULATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run AFTER activating RLS to verify enforcement.
-- Replace <uid> with real auth UUIDs from your Supabase auth.users table.
--
-- To test, set the JWT claims for each role:
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uid>","app_metadata":{"role":"EMPLOYEE"}}';
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Simulation 1: EMPLOYEE tries to read invoices (should return 0 rows) ────
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<employee-auth-uid>","app_metadata":{"role":"EMPLOYEE"}}';
-- SELECT count(*) FROM invoices;
-- Expected: 0

-- ─── Simulation 2: EMPLOYEE tries to read audit_logs (should return 0 rows) ──
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<employee-auth-uid>","app_metadata":{"role":"EMPLOYEE"}}';
-- SELECT count(*) FROM audit_logs;
-- Expected: 0

-- ─── Simulation 3: EMPLOYEE tries to read leads (should return 0 rows) ───────
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<employee-auth-uid>","app_metadata":{"role":"EMPLOYEE"}}';
-- SELECT count(*) FROM leads;
-- Expected: 0

-- ─── Simulation 4: EMPLOYEE reads only assigned clients ──────────────────────
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<employee-auth-uid>","app_metadata":{"role":"EMPLOYEE"}}';
-- SELECT count(*) FROM clients;
-- Expected: only rows where assignedEmployeeId matches the employee's record

-- ─── Simulation 5: MANAGER tries to read audit_logs (should return 0 rows) ───
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<manager-auth-uid>","app_metadata":{"role":"MANAGER"}}';
-- SELECT count(*) FROM audit_logs;
-- Expected: 0

-- ─── Simulation 6: MANAGER tries to write firm_settings (should fail) ────────
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<manager-auth-uid>","app_metadata":{"role":"MANAGER"}}';
-- UPDATE firm_settings SET "firmName" = 'Hacked' WHERE id = 'singleton';
-- Expected: 0 rows updated (RLS blocks the write)

-- ─── Simulation 7: MANAGER can read all clients ──────────────────────────────
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<manager-auth-uid>","app_metadata":{"role":"MANAGER"}}';
-- SELECT count(*) FROM clients;
-- Expected: all rows (MANAGER has full client access)

-- ─── Simulation 8: PARTNER can access everything ─────────────────────────────
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<partner-auth-uid>","app_metadata":{"role":"PARTNER"}}';
-- SELECT count(*) FROM audit_logs;
-- SELECT count(*) FROM firm_settings;
-- SELECT count(*) FROM invoices;
-- Expected: all rows returned for each table

-- ─── Simulation 9: Anonymous/CLIENT role gets nothing ────────────────────────
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<client-auth-uid>","app_metadata":{"role":"CLIENT"}}';
-- SELECT count(*) FROM clients;
-- Expected: 0 (no CLIENT policies on any staff table)

-- ─── Simulation 10: EMPLOYEE reads other employee's notifications (should fail)
-- SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<employee-auth-uid>","app_metadata":{"role":"EMPLOYEE"}}';
-- SELECT count(*) FROM notifications WHERE "userId" != '<employee-auth-uid>';
-- Expected: 0
