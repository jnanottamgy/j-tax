-- 011_time_billing.sql
--
-- Gives tracked time a price and a route to an invoice.
--
-- BACKGROUND
-- TimeEntry.billable has existed since the timesheet was built, with nothing
-- anywhere to multiply it by: no rate on the employee, no rate on the
-- engagement, and no path from billable minutes to an invoice line. The
-- timesheet therefore measured cost and never touched revenue.
--
-- employees."billingRatePerHour" is what the firm charges for that person's
-- time. NULL means not billed by the hour, which is the honest default for a
-- practice that works on fixed fees — and leaving every existing row NULL means
-- nothing changes until a rate is deliberately entered.
--
-- time_entries."invoiceId" / "invoicedAt" record which invoice the hours went
-- out on. Without them the same time could be billed twice, which is the one
-- billing mistake a client reliably notices.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS "billingRatePerHour" DECIMAL(10,2);

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS "invoiceId"  TEXT,
  ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3);

DO $$
BEGIN
  ALTER TABLE time_entries
    ADD CONSTRAINT "time_entries_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES invoices(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The unbilled-time query is "billable, not yet invoiced, for this client", so
-- index exactly that.
CREATE INDEX IF NOT EXISTS "time_entries_unbilled_idx"
  ON time_entries ("clientId")
  WHERE billable AND "invoiceId" IS NULL;

COMMIT;

-- Verify:
--   SELECT name, "billingRatePerHour" FROM employees WHERE "isActive";
--   SELECT count(*) FILTER (WHERE "invoiceId" IS NOT NULL) AS billed,
--          count(*) FILTER (WHERE "invoiceId" IS NULL AND billable) AS unbilled
--     FROM time_entries;
