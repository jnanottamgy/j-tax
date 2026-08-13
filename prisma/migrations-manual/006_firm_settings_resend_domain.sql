-- 006_firm_settings_resend_domain.sql
--
-- Adds the columns needed to make domain verification real.
--
-- BACKGROUND
-- The previous flow invented DNS records and then verified them with its own
-- dns.resolveTxt lookup, flipping domainVerified = true without ever telling
-- Resend about the domain. Resend therefore still treated the address as an
-- unverified sending identity and rejected the mail, so firms marked
-- "verified" in the UI had no email arriving.
--
-- Verification now mirrors Resend: the domain is registered in the platform's
-- Resend account, Resend issues the per-domain DKIM records, and Resend alone
-- decides when the domain is verified.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS "resendDomainId" TEXT,
  ADD COLUMN IF NOT EXISTS "domainStatus"   TEXT;

-- Any domain previously marked verified by the old self-certifying check was
-- not actually a verified Resend identity. Reset those rows so the UI stops
-- claiming direct branded sending works and falls back to the platform sender
-- (which does work) until the firm completes the real flow.
UPDATE firm_settings
   SET "domainVerified"   = FALSE,
       "domainVerifiedAt" = NULL,
       "domainStatus"     = 'not_started'
 WHERE "domainVerified" = TRUE
   AND "resendDomainId" IS NULL;

COMMIT;

-- Verify:
--   SELECT "firmName", "firmDomain", "domainVerified", "domainStatus",
--          "resendDomainId"
--     FROM firm_settings;
