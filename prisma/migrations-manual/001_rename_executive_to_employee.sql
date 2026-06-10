-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Rename EXECUTIVE → EMPLOYEE in the Role enum
-- Run this once in the Supabase SQL editor (or psql) BEFORE restarting the app.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rename the enum value (PostgreSQL 10+)
ALTER TYPE "Role" RENAME VALUE 'EXECUTIVE' TO 'EMPLOYEE';

-- 2. Verify — should return no rows if no users still have the old value
SELECT id, email, role FROM "User" WHERE role::text = 'EXECUTIVE';

-- Done. Restart the Next.js server after applying this migration.
