-- 015_tds_on_receipts.sql
--
-- Records the TDS a client deducts from the firm's own fees.
--
-- BACKGROUND
-- An Indian company paying professional fees deducts tax at source under s.194J
-- and remits it against the firm's PAN. The firm receives the net; the deducted
-- part shows up later as a credit in Form 26AS.
--
-- payment_receipts had nowhere to put it, and that was not just a gap — it was
-- wrong arithmetic. A ₹1,00,000 invoice settled by a ₹90,000 transfer with
-- ₹10,000 withheld was recorded as a ₹90,000 payment, so the invoice stayed
-- PARTIALLY_PAID with ₹10,000 outstanding for ever. The firm chased money that
-- had already been paid to the government on its behalf, every receivables
-- report was overstated by the cumulative TDS, and the only way to close such
-- an invoice was to pretend the ₹10,000 had arrived.
--
--   "tdsAmount"  — tax withheld on this receipt. Settles the invoice exactly as
--                  cash does, because the money did leave the client.
--   "tdsSection" — 194J, 194C, 194H… needed to reconcile against 26AS, which is
--                  laid out by deductor, quarter and section.
--
-- Existing rows stay NULL: no deduction was recorded, and none can be inferred
-- from a net figure. Historic invoices left short by TDS keep their balance
-- until someone settles them deliberately.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE payment_receipts
  ADD COLUMN IF NOT EXISTS "tdsAmount"  DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "tdsSection" TEXT;

-- The 26AS reconciliation reads a financial year of receipts by date.
CREATE INDEX IF NOT EXISTS "payment_receipts_paymentDate_idx"
  ON payment_receipts ("paymentDate");

COMMIT;

-- Verify — the TDS credit the firm should find in 26AS, by quarter:
--   SELECT date_trunc('quarter', "paymentDate" - INTERVAL '3 months') AS tds_quarter,
--          "tdsSection",
--          sum("tdsAmount") AS deducted
--     FROM payment_receipts
--    WHERE "tdsAmount" IS NOT NULL
--    GROUP BY 1, 2
--    ORDER BY 1;
--
-- Invoices that may be short by exactly the TDS somebody forgot to record —
-- worth reviewing once, after this ships:
--   SELECT "invoiceNumber", amount, "paidAmount", "outstandingAmount"
--     FROM invoices
--    WHERE status = 'PARTIALLY_PAID' AND "deletedAt" IS NULL
--      AND "outstandingAmount" BETWEEN amount * 0.015 AND amount * 0.11;
