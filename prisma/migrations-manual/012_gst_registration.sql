-- 012_gst_registration.sql
--
-- Lets a client say "we are not registered under GST" out loud.
--
-- BACKGROUND
-- clients.gstin being NULL covered two completely different situations:
--
--   1. the client genuinely has no GST registration, so an invoice with no
--      recipient GSTIN is exactly right; and
--   2. nobody has ever asked them for it.
--
-- The invoice came out identical either way — the place of supply falls back
-- to the firm's own state and the CGST/SGST split computes happily without a
-- recipient. Only the second case is wrong, and the firm never found out: a tax
-- invoice with no recipient GSTIN cannot support the client's input-credit
-- claim, so the GST they paid becomes their cost. They discover it at
-- reconciliation, months later, against an invoice already issued and reported.
--
-- clients."gstRegistration" holds 'UNREGISTERED' once someone has confirmed it,
-- and NULL when the question is still open. It is only consulted when gstin is
-- blank; a GSTIN on the record settles the matter by itself.
--
-- Every existing row stays NULL, which is honest: nobody has been asked yet.
-- The effect is that the app starts warning about clients whose GSTIN is
-- missing, and stops as each one is answered.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS "gstRegistration" TEXT;

COMMIT;

-- Verify — the three states, and the one that needs chasing:
--   SELECT count(*) FILTER (WHERE gstin IS NOT NULL)                          AS registered,
--          count(*) FILTER (WHERE gstin IS NULL
--                             AND "gstRegistration" = 'UNREGISTERED')         AS confirmed_b2c,
--          count(*) FILTER (WHERE gstin IS NULL
--                             AND "gstRegistration" IS NULL)                  AS never_asked
--     FROM clients
--    WHERE "deletedAt" IS NULL AND status = 'ACTIVE';
--
-- Clients the app cannot email (no schema change — this gap was always in the
-- data, just never surfaced):
--   SELECT "clientCode", name, phone
--     FROM clients
--    WHERE "deletedAt" IS NULL AND status = 'ACTIVE'
--      AND (email IS NULL OR email = '');
