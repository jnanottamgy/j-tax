-- 014_retainer_billing.sql
--
-- Lets a retainer engagement raise its own invoice.
--
-- BACKGROUND
-- client_services already IS the engagement: this client, this service, at this
-- agreed fee, on this cycle. Every column needed to bill it has been there since
-- the commercial terms were added, and nothing ever used them — so a firm with
-- sixty monthly GST clients raised sixty invoices by hand every month, from
-- memory, and the ones that got missed turned up in the receivables report or
-- not at all.
--
-- Three columns close it:
--   "autoInvoice"        — opt in, per engagement. FALSE for every existing row,
--                          because billing a client without being asked to is
--                          not a safe assumption to make on their behalf.
--   "nextBillingDate"    — when the next invoice is due to be raised. Advanced
--                          one cycle at a time, so a cron that misses a night
--                          catches up rather than skipping a month.
--   "lastAutoInvoicedAt" — when this engagement last billed itself.
--
-- Nothing changes until a retainer is switched on. Generated invoices are
-- DRAFT: the invoice should exist without being remembered, not reach the
-- client unread.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE client_services
  ADD COLUMN IF NOT EXISTS "autoInvoice"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "nextBillingDate"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastAutoInvoicedAt" TIMESTAMP(3);

-- The nightly sweep asks exactly one question: which engagements are switched
-- on and due? Index that, and nothing else.
CREATE INDEX IF NOT EXISTS "client_services_due_billing_idx"
  ON client_services ("nextBillingDate")
  WHERE "autoInvoice";

COMMIT;

-- Requires the CRON_SECRET-protected route to be scheduled:
--   /api/cron/retainer-billing  daily at 04:00 (see vercel.json)
-- Daily, not monthly: engagements bill on their own anniversary rather than all
-- on the 1st, and the engine is idempotent per client/service/period.
--
-- Verify:
--   SELECT c.name, s."serviceType", s."agreedFee", s."billingFrequency",
--          s."nextBillingDate", s."lastAutoInvoicedAt"
--     FROM client_services s
--     JOIN clients c ON c.id = s."clientId"
--    WHERE s."autoInvoice"
--    ORDER BY s."nextBillingDate";
--
-- Engagements switched on but unable to bill (no fee agreed) — these are
-- reported by the cron rather than skipped silently:
--   SELECT c.name, s."serviceType"
--     FROM client_services s JOIN clients c ON c.id = s."clientId"
--    WHERE s."autoInvoice" AND COALESCE(s."agreedFee", 0) <= 0;
