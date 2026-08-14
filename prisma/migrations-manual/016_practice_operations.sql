-- 016_practice_operations.sql
--
-- Five things a practice is expected to do that had nowhere to live: leave,
-- credit notes, client acceptance, peer review, and file retention.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- ── Leave ────────────────────────────────────────────────────────────────────
-- Assignment had no idea anyone was away. A task routed to whoever owned the
-- client sat in their queue looking assigned and worked-on while they were on
-- leave for the fortnight covering its deadline. Leave is also the missing half
-- of capacity: twenty tasks and twenty working days is a busy month, twenty
-- tasks and eight is a deadline that will be missed, and the two were
-- indistinguishable.
CREATE TABLE IF NOT EXISTS employee_leave (
  id           TEXT PRIMARY KEY,
  "firmId"     TEXT NOT NULL DEFAULT '',
  "employeeId" TEXT NOT NULL,
  "startDate"  TIMESTAMP(3) NOT NULL,
  "endDate"    TIMESTAMP(3) NOT NULL,
  type         TEXT NOT NULL DEFAULT 'ANNUAL',
  status       TEXT NOT NULL DEFAULT 'APPROVED',
  notes        TEXT,
  "approvedBy" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "employee_leave_employeeId_startDate_idx" ON employee_leave ("employeeId", "startDate");
CREATE INDEX IF NOT EXISTS "employee_leave_startDate_endDate_idx"    ON employee_leave ("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "employee_leave_firmId_idx"               ON employee_leave ("firmId");

-- ── Credit notes ─────────────────────────────────────────────────────────────
-- An invoice could be revised (a new document superseding the old) or waived
-- (written off whole), and neither is a credit note. Under s.34 of the CGST Act
-- a registered supplier reduces an already-reported invoice by issuing one,
-- which is reported in GSTR-1 in its own right and carries a deadline —
-- 30 November following the financial year of supply, after which the tax can no
-- longer be adjusted. Revising misstates a filed return; waiving loses the GST.
CREATE TABLE IF NOT EXISTS credit_notes (
  id                 TEXT PRIMARY KEY,
  "firmId"           TEXT NOT NULL DEFAULT '',
  "creditNoteNumber" TEXT NOT NULL,
  "invoiceId"        TEXT NOT NULL,
  "clientId"         TEXT NOT NULL,
  "reasonCode"       TEXT NOT NULL,
  reason             TEXT NOT NULL,
  "professionalFee"  DECIMAL(12,2) NOT NULL,
  "taxRate"          DECIMAL(5,2),
  "taxAmount"        DECIMAL(12,2) NOT NULL,
  amount             DECIMAL(12,2) NOT NULL,
  "cgstAmount"       DECIMAL(12,2),
  "sgstAmount"       DECIMAL(12,2),
  "igstAmount"       DECIMAL(12,2),
  "placeOfSupply"    TEXT,
  "issueDate"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedBy"         TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_firmId_creditNoteNumber_key" ON credit_notes ("firmId", "creditNoteNumber");
CREATE INDEX IF NOT EXISTS "credit_notes_invoiceId_idx" ON credit_notes ("invoiceId");
CREATE INDEX IF NOT EXISTS "credit_notes_clientId_idx"  ON credit_notes ("clientId");
CREATE INDEX IF NOT EXISTS "credit_notes_firmId_idx"    ON credit_notes ("firmId");

-- ── Client acceptance ────────────────────────────────────────────────────────
-- Nothing stood between "Add client" and a live engagement, so a prospect who
-- is the same entity under a second name, or the opposing party in a matter the
-- firm already acts on, was created without comment. conflictsFound is frozen
-- at decision time: the book changes, and what matters later is what was in
-- front of whoever decided.
CREATE TABLE IF NOT EXISTS client_acceptances (
  id               TEXT PRIMARY KEY,
  "firmId"         TEXT NOT NULL DEFAULT '',
  "prospectName"   TEXT NOT NULL,
  pan              TEXT,
  gstin            TEXT,
  "relatedParties" TEXT[] NOT NULL DEFAULT '{}',
  "conflictsFound" JSONB,
  outcome          TEXT NOT NULL DEFAULT 'PENDING',
  rationale        TEXT,
  "decidedBy"      TEXT,
  "decidedAt"      TIMESTAMP(3),
  "clientId"       TEXT,
  "createdBy"      TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "client_acceptances_firmId_idx"   ON client_acceptances ("firmId");
CREATE INDEX IF NOT EXISTS "client_acceptances_clientId_idx" ON client_acceptances ("clientId");

-- ── Peer review ──────────────────────────────────────────────────────────────
-- A practice unit is reviewed on a cycle and needs a valid certificate to sign
-- certain attest work. The date lived in a partner's memory until it lapsed.
CREATE TABLE IF NOT EXISTS peer_reviews (
  id              TEXT PRIMARY KEY,
  "firmId"        TEXT NOT NULL DEFAULT '',
  "periodFrom"    TIMESTAMP(3) NOT NULL,
  "periodTo"      TIMESTAMP(3) NOT NULL,
  "reviewerName"  TEXT NOT NULL,
  "reviewerFrn"   TEXT,
  status          TEXT NOT NULL DEFAULT 'SCHEDULED',
  "reviewedOn"    TIMESTAMP(3),
  "certificateNo" TEXT,
  "validUntil"    TIMESTAMP(3),
  observations    TEXT,
  notes           TEXT,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "peer_reviews_firmId_idx"     ON peer_reviews ("firmId");
CREATE INDEX IF NOT EXISTS "peer_reviews_validUntil_idx" ON peer_reviews ("validUntil");

-- ── File retention ───────────────────────────────────────────────────────────
-- SQC 1 expects working papers retained at least seven years from the date of
-- the report. Both halves matter to a reviewer: destroy early and the firm
-- cannot evidence its work; keep everything for ever and it is holding client
-- financial data it has no reason to hold. Left NULL — backfillRetentionDates
-- fills blanks deliberately rather than a migration guessing.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3);

-- Foreign keys last, so a partial run leaves no half-wired table.
DO $$ BEGIN
  ALTER TABLE employee_leave ADD CONSTRAINT "employee_leave_firmId_fkey"
    FOREIGN KEY ("firmId") REFERENCES firms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE employee_leave ADD CONSTRAINT "employee_leave_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE credit_notes ADD CONSTRAINT "credit_notes_firmId_fkey"
    FOREIGN KEY ("firmId") REFERENCES firms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE credit_notes ADD CONSTRAINT "credit_notes_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES invoices(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE credit_notes ADD CONSTRAINT "credit_notes_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE client_acceptances ADD CONSTRAINT "client_acceptances_firmId_fkey"
    FOREIGN KEY ("firmId") REFERENCES firms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE client_acceptances ADD CONSTRAINT "client_acceptances_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE peer_reviews ADD CONSTRAINT "peer_reviews_firmId_fkey"
    FOREIGN KEY ("firmId") REFERENCES firms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- Verify:
--   SELECT e.name, l."startDate", l."endDate", l.type
--     FROM employee_leave l JOIN employees e ON e.id = l."employeeId"
--    WHERE l.status = 'APPROVED' AND l."endDate" >= now() ORDER BY l."startDate";
--
--   SELECT "creditNoteNumber", "reasonCode", amount FROM credit_notes ORDER BY "issueDate" DESC;
--
--   SELECT "reviewerName", "validUntil", "validUntil" - now() AS remaining
--     FROM peer_reviews WHERE "validUntil" IS NOT NULL ORDER BY "validUntil";
--
--   SELECT count(*) FILTER (WHERE "retentionUntil" IS NULL) AS unset,
--          count(*) FILTER (WHERE "retentionUntil" < now()) AS destroyable
--     FROM documents WHERE "deletedAt" IS NULL;
