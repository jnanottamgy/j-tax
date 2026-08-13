-- 010_client_facts_and_engagements.sql
--
-- The facts about a client the app never asked for, and the two records a
-- practice is expected to keep that had nowhere to live.
--
-- 1. ACCOUNTING YEAR  (clients."fyEndMonth")
--    31 March was assumed everywhere. A foreign-parented subsidiary usually
--    closes in December to match its group. Indian statutory deadlines still
--    run April–March by law (s.3 of the Income-tax Act), so this drives the
--    firm's own planning rather than the statutory calendar.
--
-- 2. SCALE  (clients."annualTurnover", "turnoverFy", "gstFilingScheme")
--    GST filing frequency was picked by hand from a dropdown with nothing
--    behind it. Aggregate turnover up to ₹5 crore means the client may file
--    quarterly under QRMP; above it, monthly is mandatory. Turnover also
--    indicates s.44AB tax-audit applicability.
--
-- 3. CONTACT ROUTING  (client_contacts."handles")
--    One email and phone per client, so a GST reminder and an audit query went
--    to the same person — usually the wrong one for at least one of them.
--
-- 4. ICAI IDENTITY  (firm_settings."icaiFrn", "icaiMembershipNo")
--    The Firm Registration Number belongs on every audit report and
--    certificate, and the membership number is what UDIN is keyed on. Neither
--    was collected anywhere in the product.
--
-- 5. ENGAGEMENT LETTERS  (engagement_letters)
--    SA 210 expects terms agreed in writing before work starts, and a peer
--    review asks to see them.
--
-- 6. FILING HISTORY  (filing_records)
--    A client moving from another CA arrives with a year of history the app
--    could not hold. The same table records our own acknowledgement numbers.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- ── 1 & 2. Client facts ──────────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS "fyEndMonth"      INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "annualTurnover"  DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "turnoverFy"      TEXT,
  ADD COLUMN IF NOT EXISTS "gstFilingScheme" TEXT;

-- ── 3. Contact routing ───────────────────────────────────────────────────────

ALTER TABLE client_contacts
  ADD COLUMN IF NOT EXISTS "handles" "ServiceType"[] NOT NULL DEFAULT '{}';

-- ── 4. ICAI identity ─────────────────────────────────────────────────────────

ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS "icaiFrn"          TEXT,
  ADD COLUMN IF NOT EXISTS "icaiMembershipNo" TEXT;

-- ── 5. Engagement letters ────────────────────────────────────────────────────

DO $$
BEGIN
  CREATE TYPE "EngagementLetterStatus" AS ENUM
    ('DRAFT', 'ISSUED', 'SIGNED', 'DECLINED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS engagement_letters (
  id              TEXT PRIMARY KEY,
  "firmId"        TEXT NOT NULL DEFAULT '',
  "clientId"      TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "serviceTypes"  "ServiceType"[] NOT NULL DEFAULT '{}',
  scope           TEXT,
  "feeAgreed"     DECIMAL(12,2),
  status          "EngagementLetterStatus" NOT NULL DEFAULT 'DRAFT',
  "issuedAt"      TIMESTAMP(3),
  "signedAt"      TIMESTAMP(3),
  "expiresAt"     TIMESTAMP(3),
  "documentId"    TEXT,
  notes           TEXT,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT engagement_letters_firm_fkey
    FOREIGN KEY ("firmId") REFERENCES firms(id) ON DELETE CASCADE,
  CONSTRAINT engagement_letters_client_fkey
    FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "engagement_letters_clientId_financialYear_idx"
  ON engagement_letters ("clientId", "financialYear");
CREATE INDEX IF NOT EXISTS "engagement_letters_status_expiresAt_idx"
  ON engagement_letters (status, "expiresAt");
CREATE INDEX IF NOT EXISTS "engagement_letters_firmId_idx"
  ON engagement_letters ("firmId");

-- ── 6. Filing history ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS filing_records (
  id                  TEXT PRIMARY KEY,
  "firmId"            TEXT NOT NULL DEFAULT '',
  "clientId"          TEXT NOT NULL,
  "financialYear"     TEXT NOT NULL,
  "filingType"        TEXT NOT NULL,
  "serviceType"       "ServiceType",
  period              TEXT,
  "filedOn"           TIMESTAMP(3),
  "acknowledgementNo" TEXT,
  "filedByExternal"   TEXT,
  "taskId"            TEXT,
  "documentId"        TEXT,
  notes               TEXT,
  "createdBy"         TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT filing_records_firm_fkey
    FOREIGN KEY ("firmId") REFERENCES firms(id) ON DELETE CASCADE,
  CONSTRAINT filing_records_client_fkey
    FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT filing_records_task_fkey
    FOREIGN KEY ("taskId") REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "filing_records_clientId_financialYear_idx"
  ON filing_records ("clientId", "financialYear");
CREATE INDEX IF NOT EXISTS "filing_records_taskId_idx"
  ON filing_records ("taskId");
CREATE INDEX IF NOT EXISTS "filing_records_firmId_idx"
  ON filing_records ("firmId");

COMMIT;

-- NOTE ON EXISTING CLIENTS
-- Turnover is deliberately left NULL rather than guessed. resolveGstScheme()
-- treats "no turnover recorded" as monthly filing, which is what every client
-- already had, so nothing changes until a real figure is entered. Over-filing
-- is recoverable; a missed GSTR-3B carries interest and late fees.
--
-- Verify:
--   SELECT count(*) FILTER (WHERE "annualTurnover" IS NOT NULL) AS with_turnover,
--          count(*) FILTER (WHERE "fyEndMonth" <> 3) AS non_march_year_end
--     FROM clients WHERE "deletedAt" IS NULL;
--   SELECT "firmName", "icaiFrn", "icaiMembershipNo" FROM firm_settings;
--   SELECT count(*) FROM engagement_letters;
--   SELECT count(*) FROM filing_records WHERE "filedByExternal" IS NOT NULL;
