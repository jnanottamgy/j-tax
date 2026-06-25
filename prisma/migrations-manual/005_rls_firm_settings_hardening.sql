-- ────────────────────────────────────────────────────────────────────────────
-- 005_rls_firm_settings_hardening.sql
-- Defense-in-depth for firm_settings writes.
--
-- The policies in 002_rls_policies.sql are ALREADY correct:
--   firm_settings_partner_all  — PARTNER may SELECT/INSERT/UPDATE/DELETE
--   firm_settings_staff_read   — MANAGER/EMPLOYEE may SELECT only
-- and PostgreSQL's RLS default-deny correctly blocks MANAGER/EMPLOYEE writes
-- (no policy matches an INSERT/UPDATE/DELETE under those roles).
--
-- This migration adds two redundant layers so any future policy mistake can't
-- silently open writes:
--
--   1. ALTER TABLE … FORCE ROW LEVEL SECURITY
--      Without this, the table owner (postgres) can bypass RLS. FORCE makes
--      RLS apply to the owner too, so a misconfigured policy can't be tested
--      around with `SET ROLE postgres`.
--
--   2. REVOKE INSERT/UPDATE/DELETE … FROM authenticated, anon
--      Table-level GRANT removal. Even if every RLS policy were dropped, the
--      authenticated/anon roles would still be denied writes at the grant
--      layer. The Next.js backend uses the service_role connection which
--      retains its grants, so application code is unaffected.
--
-- Idempotent. Safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.firm_settings FORCE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.firm_settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.firm_settings FROM anon;

-- service_role keeps full access — this is what the Next.js backend uses.
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.firm_settings TO service_role;

-- authenticated still needs SELECT for the staff-read policy to be useful.
GRANT  SELECT ON public.firm_settings TO authenticated;

-- ── Verification ────────────────────────────────────────────────────────────
-- Run after applying:
--
-- 1. Show the FORCE flag is set
--    SELECT relname, relrowsecurity, relforcerowsecurity
--      FROM pg_class WHERE relname = 'firm_settings';
--    Expected: relforcerowsecurity = true
--
-- 2. Show grants for authenticated
--    SELECT grantee, privilege_type
--      FROM information_schema.role_table_grants
--     WHERE table_name = 'firm_settings'
--       AND grantee IN ('authenticated','anon','service_role')
--     ORDER BY grantee, privilege_type;
--    Expected:
--      anon          — (no rows; no grants at all)
--      authenticated — SELECT only
--      service_role  — SELECT, INSERT, UPDATE, DELETE
--
-- 3. Re-run scripts/rls-write-probe.ts:
--    Expected — all 5 firm_settings rows PASS as before:
--      ✓ PARTNER  UPDATE  expect=ALLOW  got=ALLOWED — 1 row(s) modified
--      ✓ MANAGER  UPDATE  expect=DENY   got=DENIED
--      ✓ EMPLOYEE UPDATE  expect=DENY   got=DENIED
--      ✓ MANAGER  INSERT  expect=DENY   got=DENIED (now raises grant error before RLS)
--      ✓ EMPLOYEE INSERT  expect=DENY   got=DENIED

COMMIT;
