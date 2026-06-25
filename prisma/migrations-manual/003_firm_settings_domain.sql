-- ────────────────────────────────────────────────────────────────────────────
-- 003_firm_settings_domain.sql
-- Adds domain-verification fields to firm_settings for firm-branded email Phase 8.
-- Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.firm_settings
  ADD COLUMN IF NOT EXISTS "firmDomain"             text,
  ADD COLUMN IF NOT EXISTS "domainVerified"         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "domainVerifiedAt"       timestamp(3),
  ADD COLUMN IF NOT EXISTS "verificationToken"      text,
  ADD COLUMN IF NOT EXISTS "platformFallbackEnabled" boolean NOT NULL DEFAULT true;

-- Verification queries — run these after applying:
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'firm_settings'
--  ORDER BY ordinal_position;

COMMIT;
