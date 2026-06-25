# RLS Activation Guide — J-TACS Database Security

## Overview

This guide walks through activating Row-Level Security (RLS) on all 36 tables in the J-TACS database. After activation, direct database access (via Supabase client/PostgREST) is restricted by role.

**The Next.js backend uses the service-role key and is NOT affected** — all server actions continue to work exactly as before.

---

## Prerequisites

1. Migration 001 (`001_rename_executive_to_employee.sql`) already applied
2. Access to Supabase SQL Editor (postgres superuser)
3. At least one PARTNER user exists with `app_metadata.role = "PARTNER"`

---

## Step-by-Step Activation

### Step 1 — Backup (recommended)

In Supabase Dashboard > Settings > Database, create a point-in-time backup or note the current timestamp for recovery.

### Step 2 — Run the migration

1. Open Supabase Dashboard > SQL Editor
2. Open `prisma/migrations-manual/002_rls_policies.sql`
3. Copy the **entire** file contents into the SQL editor
4. Click **Run**
5. The transaction will either fully succeed or fully roll back

### Step 3 — Verify RLS is active

After the migration completes, the verification queries at the bottom will run automatically. Check:

- **Query 5a**: All 36 tables should show `rowsecurity = true`
- **Query 5b**: Count should be `36`
- **Query 5c**: Should show 56 policies across 36 tables
- **Query 5f**: Should return **0 rows** (no unprotected tables)
- **Query 5g**: Should show 2 functions in `jtacs_auth` schema (`user_role`, `employee_id`)
- **Query 5h**: Should confirm `jtacs_auth` schema exists

### Step 4 — Test role enforcement

Run these test queries in the SQL editor to verify each role:

```sql
-- Test as EMPLOYEE (replace <uid> with a real EMPLOYEE auth UUID)
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uid>","app_metadata":{"role":"EMPLOYEE"}}';

-- Should return 0 (EMPLOYEE cannot see invoices)
SELECT count(*) FROM invoices;

-- Should return 0 (EMPLOYEE cannot see audit logs)
SELECT count(*) FROM audit_logs;

-- Should return 0 (EMPLOYEE cannot see leads/proposals)
SELECT count(*) FROM leads;

-- Should return only assigned clients
SELECT count(*) FROM clients;

-- Reset
RESET request.jwt.claims;
```

```sql
-- Test as MANAGER
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uid>","app_metadata":{"role":"MANAGER"}}';

-- Should return 0 (MANAGER cannot see audit logs)
SELECT count(*) FROM audit_logs;

-- Should return all clients (MANAGER has full client access)
SELECT count(*) FROM clients;

-- Should fail silently (0 rows affected — MANAGER cannot write firm_settings)
UPDATE firm_settings SET "firmName" = 'Test' WHERE id = 'singleton';

RESET request.jwt.claims;
```

```sql
-- Test as PARTNER (should have full access to everything)
SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uid>","app_metadata":{"role":"PARTNER"}}';

SELECT count(*) FROM audit_logs;    -- all rows
SELECT count(*) FROM clients;       -- all rows
SELECT count(*) FROM invoices;      -- all rows
SELECT count(*) FROM firm_settings; -- all rows

RESET request.jwt.claims;
```

### Step 5 — Test the application

1. Log in as PARTNER — verify all pages load correctly
2. Log in as MANAGER — verify dashboard, clients, tasks work
3. Log in as EMPLOYEE — verify assigned clients and tasks appear

The application uses the service-role key, so all server actions bypass RLS. These tests confirm the UI layer still works.

---

## Rollback

If anything goes wrong, disable RLS on all tables:

```sql
ALTER TABLE firm_settings                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE "User"                         DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients                        DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_services                DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                          DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments               DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_automations               DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_schedules           DISABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events              DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions              DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_activities            DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates              DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages                       DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                       DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts               DISABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_reminders              DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders                      DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sessions              DISABLE ROW LEVEL SECURITY;
ALTER TABLE employee_activities            DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records             DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads                          DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations                     DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items                DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_email_logs           DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_follow_ups           DISABLE ROW LEVEL SECURITY;
ALTER TABLE client_timeline_events         DISABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_compliance_templates DISABLE ROW LEVEL SECURITY;

-- Also drop the custom schema and its functions
DROP SCHEMA IF EXISTS jtacs_auth CASCADE;
```

---

## Security Matrix Quick Reference

| Access Level | Tables |
|---|---|
| **PARTNER only** | `audit_logs`, `activity_logs` |
| **PARTNER write / staff read** | `firm_settings`, `"User"`, `recurring_compliance_templates` |
| **PARTNER+MANAGER full** | `invoices`, `payment_receipts`, `follow_ups`, `invoice_reminders`, `leads`, `quotations`, `quotation_items`, `quotation_email_logs`, `quotation_follow_ups`, `task_automations` |
| **PARTNER+MANAGER full / EMPLOYEE read (assigned)** | `clients`, `client_services`, `compliance_schedules`, `documents`, `document_versions`, `document_tags`, `document_activities`, `messages`, `message_logs`, `reminders`, `client_timeline_events` |
| **PARTNER+MANAGER full / EMPLOYEE full (assigned)** | `tasks`, `task_comments`, `task_attachments`, `compliance_events` |
| **PARTNER+MANAGER full / EMPLOYEE read-only** | `message_templates` |
| **PARTNER full / MANAGER read / EMPLOYEE read (own)** | `employee_sessions`, `employee_activities`, `attendance_records` |
| **PARTNER+MANAGER full / EMPLOYEE read (own)** | `employees` |
| **All staff — own records only** | `notifications` |

---

## Architecture Notes

- **Custom schema**: Helper functions live in the `jtacs_auth` schema (NOT the Supabase `auth` schema, which is read-only). They call `auth.jwt()` and `auth.uid()` from the Supabase auth schema internally.
- **Helper functions**: `jtacs_auth.user_role()` extracts role from JWT `app_metadata`. `jtacs_auth.employee_id()` is `SECURITY DEFINER` to bypass RLS when looking up the caller's employee record.
- **EMPLOYEE scoping**: Uses `assignedEmployeeId` on `clients` table for direct lookups, and `EXISTS` subqueries for child tables that join through `clients`.
- **Service-role bypass**: The Next.js backend's Prisma client uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses all RLS policies. This is the intended behavior.
- **CLIENT role**: No policies exist for CLIENT on any staff table. CLIENT users access data only through the client portal, which uses the service-role key.
