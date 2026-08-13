-- 007_firm_settings_logo.sql
--
-- Adds firm letterhead storage.
--
-- BACKGROUND
-- Invoices and quotations rendered the firm name as plain text in the header
-- band. Every practice a firm competes with puts a letterhead on the PDF, so
-- the documents a client actually receives looked like a template rather than
-- the firm's own stationery.
--
-- The bytes live inline (base64) rather than in Supabase Storage on purpose:
-- it is one downscaled image per firm (capped at ~400 KB), pdfkit needs the
-- bytes in hand because it cannot take a URL, and an inline column removes any
-- dependency on bucket provisioning or signed-URL expiry for something that
-- must render on every single invoice. lib/firm-settings.ts selects columns
-- explicitly so the hot read never drags the blob along.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS "logoData"      TEXT,
  ADD COLUMN IF NOT EXISTS "logoMimeType"  TEXT,
  ADD COLUMN IF NOT EXISTS "logoFileName"  TEXT,
  ADD COLUMN IF NOT EXISTS "logoUpdatedAt" TIMESTAMP(3);

COMMIT;

-- Verify:
--   SELECT "firmName", "logoMimeType", "logoFileName", "logoUpdatedAt",
--          length("logoData") AS base64_len
--     FROM firm_settings;
