-- 008_engagement_portal_revisions.sql
--
-- Repairs four places where information stopped flowing between modules.
--
-- 1. COMPLIANCE COVERAGE (no schema change — data repair only)
--    Clients were created with status = 'PENDING' because that was the column
--    default, while generateRecurringComplianceTasks() only ever queried
--    status = 'ACTIVE'. Every client a firm onboarded was therefore invisible
--    to the recurring compliance engine, silently and permanently. New clients
--    are now created ACTIVE; the UPDATE below repairs the ones already stuck.
--
-- 2. ENGAGEMENT TERMS  (client_services)
--    The fee agreed on a quotation was shown to the client and then dropped —
--    ClientService had no fee at all, so every invoice was retyped from memory
--    and no report could compare quoted against billed.
--
-- 3. CLIENT PORTAL ACCESS  (clients)
--    The portal resolved a client by matching session email against the
--    client's email, so access could not be granted from the app at all.
--
-- 4. QUOTATION REVISIONS  (quotations)
--    Quotations had no update path. Renegotiating meant deleting and rebuilding,
--    losing the number, the sent/viewed timestamps and the email log.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- ── 2. Engagement terms ──────────────────────────────────────────────────────

ALTER TABLE client_services
  ADD COLUMN IF NOT EXISTS "agreedFee"             DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "billingFrequency"      "ServiceFrequency",
  ADD COLUMN IF NOT EXISTS "sourceQuotationItemId" TEXT,
  ADD COLUMN IF NOT EXISTS "feeAgreedAt"           TIMESTAMP(3);

-- ── 3. Client portal access ──────────────────────────────────────────────────

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS "portalUserId"     TEXT,
  ADD COLUMN IF NOT EXISTS "portalInvitedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "portalLastSeenAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "clients_firmId_portalUserId_key"
  ON clients ("firmId", "portalUserId");
CREATE INDEX IF NOT EXISTS "clients_portalUserId_idx"
  ON clients ("portalUserId");

-- ── 4. Quotation revisions ───────────────────────────────────────────────────

DO $$
BEGIN
  ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS "revisedFromId"  TEXT,
  ADD COLUMN IF NOT EXISTS "revisionNumber" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE quotations
    ADD CONSTRAINT "quotations_revisedFromId_fkey"
    FOREIGN KEY ("revisedFromId") REFERENCES quotations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "quotations_revisedFromId_idx"
  ON quotations ("revisedFromId");

COMMIT;

-- ── 1. Compliance coverage repair ────────────────────────────────────────────
--
-- Deliberately a separate transaction, and deliberately narrow: only clients
-- that are PENDING *and* carry at least one active service. A firm that wanted
-- a client paused would have used ON_HOLD or INACTIVE — both already exist and
-- are reachable in the UI. PENDING was never chosen; it was inherited from the
-- column default, which is exactly why nobody noticed the engine skipping them.
--
-- Review before running on live data:
--   SELECT c.id, c."clientCode", c.name, c.status, count(s.id) AS services
--     FROM clients c JOIN client_services s
--       ON s."clientId" = c.id AND s."isActive"
--    WHERE c.status = 'PENDING' AND c."deletedAt" IS NULL
--    GROUP BY c.id;

BEGIN;

UPDATE clients c
   SET status = 'ACTIVE'
 WHERE c.status = 'PENDING'
   AND c."deletedAt" IS NULL
   AND EXISTS (
     SELECT 1 FROM client_services s
      WHERE s."clientId" = c.id AND s."isActive"
   );

COMMIT;

-- Verify:
--   SELECT status, count(*) FROM clients WHERE "deletedAt" IS NULL GROUP BY status;
--   SELECT count(*) FROM client_services WHERE "agreedFee" IS NOT NULL;
--   SELECT count(*) FROM clients WHERE "portalUserId" IS NOT NULL;
--   SELECT "quotationNumber", "revisionNumber", status FROM quotations
--    WHERE "revisedFromId" IS NOT NULL;
