-- 019_production_reset.sql
--
-- EMPTIES THE DATABASE. Every row of every table, for every firm.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- READ THIS BEFORE RUNNING IT
--
-- This is for one situation only: the database has development and demo data in
-- it, no real client has ever used it, and you want to hand a clean instance to
-- your first customer.
--
-- It is NOT a migration. Nothing calls it. It will never run by itself. It
-- destroys data and cannot be undone.
--
-- If there is ANY real data in this database — one real client, one real
-- invoice — do not run this. Point the new customer at a fresh database
-- instead. Creating a new database costs an hour; this costs everything.
--
-- Take a backup first even if you are certain:
--   pg_dump "$DATABASE_URL" > backup-before-reset-$(date +%F).sql
--
-- The schema is left completely intact. Only rows go.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- WHAT SURVIVES: nothing in Postgres. Note that Supabase Auth users live in a
-- separate schema this does not touch — see the note at the bottom, because
-- leaving them behind will block the new firm's signup.

BEGIN;

-- One statement so foreign keys never fight the order, and so a failure
-- anywhere rolls the whole thing back rather than leaving a half-empty
-- database that looks usable.
TRUNCATE TABLE
  -- Work
  task_comments,
  task_attachments,
  task_dependencies,
  task_checklist_items,
  task_automations,
  tasks,
  job_templates,
  time_entries,

  -- Compliance and filings
  compliance_events,
  compliance_schedules,
  filing_records,
  udin_records,
  dsc_records,
  statutory_registrations,

  -- Money
  payment_receipts,
  follow_ups,
  credit_notes,
  invoices,

  -- Pipeline
  quotation_items,
  quotation_email_logs,
  quotation_follow_ups,
  quotations,
  leads,

  -- Clients
  client_document_checklist_items,
  client_services,
  client_team_members,
  client_timeline_events,
  client_acceptances,
  document_request_items,
  document_requests,
  document_versions,
  document_tags,
  document_activities,
  documents,
  engagement_letters,
  messages,
  message_templates,
  reminders,
  credentials,
  gst_recon_runs,
  itr_computations,
  tax_notices,
  financial_statements,
  clients,
  client_groups,

  -- People and their record
  employee_sessions,
  employee_activitys,
  attendance_records,
  employee_leave,
  employees,
  peer_reviews,

  -- Platform
  notifications,
  activity_logs,
  audit_logs,
  users,
  firm_settings,
  firms
RESTART IDENTITY CASCADE;

COMMIT;

-- Verify it is actually empty. Every count should be zero:
--   SELECT
--     (SELECT count(*) FROM firms)     AS firms,
--     (SELECT count(*) FROM users)     AS users,
--     (SELECT count(*) FROM clients)   AS clients,
--     (SELECT count(*) FROM tasks)     AS tasks,
--     (SELECT count(*) FROM invoices)  AS invoices,
--     (SELECT count(*) FROM employees) AS employees;
--
-- ─────────────────────────────────────────────────────────────────────────────
-- STILL TO DO AFTER THIS — the parts that are not in this database
--
-- 1. SUPABASE AUTH USERS. Login accounts live in Supabase's own auth schema,
--    which this does not touch. Leaving them behind is not cosmetic: signup
--    refuses an email that already has an auth account, so a leftover dev login
--    on your customer's address will block them from registering.
--
--    Delete them from the Supabase dashboard (Authentication → Users), or:
--      DELETE FROM auth.users;
--    Run that only against the same dev project you just truncated.
--
-- 2. UPLOADED FILES. Anything in the `documents` storage bucket is orphaned now
--    — the rows that pointed at it are gone. Empty the bucket in the Supabase
--    dashboard (Storage → documents), or it stays there costing money and
--    holding whatever test files were uploaded.
--
-- 3. Confirm the app comes up clean: sign up as the new firm, and check the
--    dashboard shows an empty state rather than an error.
