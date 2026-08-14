-- 013_udin_filing_link.sql
--
-- Ties a UDIN to the filing it was generated for.
--
-- BACKGROUND
-- udin_records held the number, the client and a free-text document type, and
-- nothing that pointed at the work. So the register could list what had been
-- generated but could not answer which signed document each number belonged
-- to — which is the only question anyone opens a UDIN register to answer, and
-- exactly what a peer reviewer asks.
--
-- filing_records already carries the task, the acknowledgement number and the
-- document, so one foreign key joins the whole chain:
--   UDIN -> filing -> task -> client.
--
-- Nullable on purpose. Every existing row stays unlinked, which is honest —
-- nobody recorded the connection at the time and it cannot be inferred. The
-- register shows those rows as "Not linked to a filing" rather than pretending.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE udin_records
  ADD COLUMN IF NOT EXISTS "filingRecordId" TEXT;

DO $$
BEGIN
  ALTER TABLE udin_records
    ADD CONSTRAINT "udin_records_filingRecordId_fkey"
    FOREIGN KEY ("filingRecordId") REFERENCES filing_records(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "udin_records_filingRecordId_idx"
  ON udin_records ("filingRecordId");

COMMIT;

-- Verify — how much of the register can now name its document:
--   SELECT count(*) FILTER (WHERE "filingRecordId" IS NOT NULL) AS linked,
--          count(*) FILTER (WHERE "filingRecordId" IS NULL)     AS unlinked
--     FROM udin_records;
