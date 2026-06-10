-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001: Rename Role enum value EXECUTIVE → EMPLOYEE
-- Run this ONCE in the Supabase SQL editor (or psql) BEFORE restarting the app.
-- Idempotent: safe to run even if already applied (ALTER will error on re-run,
-- but the DO block below catches that gracefully).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rename the enum value (PostgreSQL 10+)
--    Wrapped in a DO block so it is a no-op if the value is already EMPLOYEE.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'EXECUTIVE'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
  ) THEN
    ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE';
    RAISE NOTICE 'Role enum: EXECUTIVE → EMPLOYEE applied.';
  ELSE
    RAISE NOTICE 'Role enum: EXECUTIVE not found — migration already applied or not needed.';
  END IF;
END
$$;

-- 2. Verify the User table — should return 0 rows once migration is applied
SELECT id, email, role
FROM "User"
WHERE role::text = 'EXECUTIVE';

-- 3. Verify the current enum values (expected: PARTNER, MANAGER, EMPLOYEE, CLIENT)
SELECT enumlabel AS role_value
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'Role')
ORDER BY enumsortorder;
