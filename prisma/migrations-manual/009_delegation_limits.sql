-- 009_delegation_limits.sql
--
-- Adds a value ceiling on what a Manager can issue without a Partner.
--
-- BACKGROUND
-- A ₹5,000 quotation already needed Partner approval before it could be sent,
-- while a ₹5,00,000 invoice needed none — the money actually leaving the firm
-- was the one thing with no ceiling on it.
--
-- firm_settings."invoiceApprovalLimit" is the threshold (incl. GST). NULL means
-- no limit, which is where every existing firm starts: this migration does not
-- impose a figure, because the right number for a two-partner practice is not
-- the right number for a twenty-partner one. The Partner sets it in
-- Settings → Firm Details.
--
-- invoices."requiresApproval" is frozen at creation rather than recomputed, so
-- raising or lowering the limit later never retroactively releases an invoice
-- that was held, nor gates one that has already gone out.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS "invoiceApprovalLimit" DECIMAL(12,2);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "approvedBy"       TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt"       TIMESTAMP(3);

-- Partial index: the dashboard queue asks only for the held ones, and on a
-- busy firm that is a handful of rows out of thousands.
CREATE INDEX IF NOT EXISTS "invoices_pending_approval_idx"
  ON invoices ("firmId", "createdAt")
  WHERE "requiresApproval" AND "approvedAt" IS NULL;

COMMIT;

-- Verify:
--   SELECT "firmName", "invoiceApprovalLimit" FROM firm_settings;
--   SELECT "invoiceNumber", amount, "requiresApproval", "approvedAt"
--     FROM invoices WHERE "requiresApproval";
