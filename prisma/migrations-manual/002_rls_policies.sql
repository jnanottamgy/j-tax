-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Row-Level Security policies for J-TAX
--
-- Prerequisites:
--   1. Run in the Supabase SQL editor as the postgres superuser.
--   2. Migration 001 (EXECUTIVE → EMPLOYEE rename) must already be applied.
--   3. The Supabase service-role key is used by the Next.js backend and bypasses
--      RLS automatically — these policies protect direct API / anon access only.
--
-- Strategy:
--   • Each table gets a helper function that reads the caller's role from
--     auth.jwt() → app_metadata.role (set by the auth action on sign-in).
--   • PARTNER sees everything.
--   • MANAGER sees everything except tables restricted to PARTNER.
--   • EMPLOYEE sees only records linked to their Employee row.
--   • CLIENT sees only their own portal data.
--   • The service-role context (used by Next.js server actions) bypasses RLS
--     entirely — no policy needed for it.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper: extract role from JWT ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() ->> 'role',
    'anon'
  );
$$;

-- ─── Helper: extract the Employee.id linked to the current auth user ──────────

CREATE OR REPLACE FUNCTION auth.employee_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT id
  FROM employees
  WHERE "userId" = auth.uid()::text
    AND "isActive" = true
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: clients
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- PARTNER / MANAGER: full access
CREATE POLICY "clients_partner_manager_all"
  ON clients FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

-- EMPLOYEE: read only their assigned clients
CREATE POLICY "clients_employee_assigned_read"
  ON clients FOR SELECT
  USING (
    auth.user_role() = 'EMPLOYEE'
    AND "assignedEmployeeId" = auth.employee_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: tasks
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_partner_manager_all"
  ON tasks FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "tasks_employee_assigned_all"
  ON tasks FOR ALL
  USING (
    auth.user_role() = 'EMPLOYEE'
    AND "assignedEmployeeId" = auth.employee_id()
  )
  WITH CHECK (
    auth.user_role() = 'EMPLOYEE'
    AND "assignedEmployeeId" = auth.employee_id()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: invoices
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- PARTNER / MANAGER: full access
CREATE POLICY "invoices_partner_manager_all"
  ON invoices FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

-- EMPLOYEE: no direct access (route-level restriction enforced in app)
-- No EMPLOYEE policy → EMPLOYEE cannot read invoices via direct API calls.

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: documents
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_partner_manager_all"
  ON documents FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

-- EMPLOYEE: read documents for their assigned clients
CREATE POLICY "documents_employee_read"
  ON documents FOR SELECT
  USING (
    auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = documents."clientId"
        AND c."assignedEmployeeId" = auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: notifications
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Each user can only access their own notifications
CREATE POLICY "notifications_own_user_all"
  ON notifications FOR ALL
  USING (
    auth.user_role() IN ('PARTNER', 'MANAGER', 'EMPLOYEE')
    AND "userId" = auth.uid()::text
  )
  WITH CHECK (
    auth.user_role() IN ('PARTNER', 'MANAGER', 'EMPLOYEE')
    AND "userId" = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: employees
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- PARTNER / MANAGER: full access
CREATE POLICY "employees_partner_manager_all"
  ON employees FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

-- EMPLOYEE: read their own record only
CREATE POLICY "employees_self_read"
  ON employees FOR SELECT
  USING (
    auth.user_role() = 'EMPLOYEE'
    AND "userId" = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: compliance_events
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_partner_manager_all"
  ON compliance_events FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "compliance_employee_assigned_all"
  ON compliance_events FOR ALL
  USING (
    auth.user_role() = 'EMPLOYEE'
    AND (
      "clientId" IS NULL
      OR EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = compliance_events."clientId"
          AND c."assignedEmployeeId" = auth.employee_id()
      )
    )
  )
  WITH CHECK (
    auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = compliance_events."clientId"
        AND c."assignedEmployeeId" = auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: messages
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_partner_manager_all"
  ON messages FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

CREATE POLICY "messages_employee_assigned_read"
  ON messages FOR SELECT
  USING (
    auth.user_role() = 'EMPLOYEE'
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = messages."clientId"
        AND c."assignedEmployeeId" = auth.employee_id()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: firm_settings
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE firm_settings ENABLE ROW LEVEL SECURITY;

-- PARTNER: full access (only PARTNER can write)
CREATE POLICY "firm_settings_partner_all"
  ON firm_settings FOR ALL
  USING (auth.user_role() = 'PARTNER')
  WITH CHECK (auth.user_role() = 'PARTNER');

-- MANAGER / EMPLOYEE: read-only (so settings page can show current values)
CREATE POLICY "firm_settings_staff_read"
  ON firm_settings FOR SELECT
  USING (auth.user_role() IN ('MANAGER', 'EMPLOYEE'));

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: leads / quotations (proposals module — PARTNER + MANAGER)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_partner_manager_all"
  ON leads FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotations_partner_manager_all"
  ON quotations FOR ALL
  USING (auth.user_role() IN ('PARTNER', 'MANAGER'))
  WITH CHECK (auth.user_role() IN ('PARTNER', 'MANAGER'));

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: activity_logs / audit_logs — PARTNER only (via app; RLS backs this up)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_partner_all"
  ON activity_logs FOR ALL
  USING (auth.user_role() = 'PARTNER')
  WITH CHECK (auth.user_role() = 'PARTNER');

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_partner_all"
  ON audit_logs FOR ALL
  USING (auth.user_role() = 'PARTNER')
  WITH CHECK (auth.user_role() = 'PARTNER');

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────────────

-- List all tables with RLS enabled (should include all tables above)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;

-- List all policies created
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
