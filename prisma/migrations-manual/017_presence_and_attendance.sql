-- 017_presence_and_attendance.sql
--
-- Makes recorded hours reflect time actually worked.
--
-- BACKGROUND
-- Presence was inferred from session lifecycle events. durationMinutes was
-- logoutAt - loginAt, and the day's workMinutes were only written by the
-- sign-out handler. Three consequences, all of them live:
--
--   * Almost nobody signs out; they close the tab. The handler never ran, so
--     durationMinutes stayed NULL and workMinutes was never written — every
--     such day recorded ZERO hours worked.
--   * A session left open read as (now - loginAt) on the dashboard, so a tab
--     forgotten on Friday reported seventy-two hours on Monday.
--   * Even a clean sign-out measured wall clock, lunch and all.
--
-- The five-minute heartbeat already existed and was never counted. It is now
-- the source of truth: each beat credits the time since the last one, capped,
-- and a closed tab simply stops earning minutes.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- Minutes accumulated from heartbeats.
ALTER TABLE employee_sessions
  ADD COLUMN IF NOT EXISTS "activeMinutes" INTEGER NOT NULL DEFAULT 0;

-- Historic rows: seed activeMinutes from whatever was measured, so past
-- reports do not suddenly read zero. Deliberately does NOT invent minutes for
-- the sessions that recorded NULL — those hours were never captured and a
-- guessed figure in an attendance table is worse than an honest gap.
UPDATE employee_sessions
   SET "activeMinutes" = "durationMinutes"
 WHERE "durationMinutes" IS NOT NULL
   AND "activeMinutes" = 0;

-- The nightly sweep asks "which sessions have gone quiet?" — index exactly it.
CREATE INDEX IF NOT EXISTS "employee_sessions_stale_idx"
  ON employee_sessions ("lastActiveAt")
  WHERE "isActive";

-- Working hours, per firm. The late rule was hard-coded to 09:30 IST with no
-- grace, so a practice starting at 10:00 marked its whole team late every day,
-- and Saturday — an ordinary working day for most Indian firms — was judged by
-- the same rule with no way to change it.
ALTER TABLE firm_settings
  ADD COLUMN IF NOT EXISTS "workDayStart"          TEXT    NOT NULL DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS "lateGraceMinutes"      INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "workingWeekdays"       INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 330;

COMMIT;

-- Requires two CRON_SECRET-protected routes to be scheduled (see vercel.json):
--   /api/cron/workforce-sweep    18:45 UTC daily — closes quiet sessions,
--                                writes approved leave into attendance, purges
--                                session rows past retention.
--   /api/cron/attendance-check   06:00 UTC daily — reports who has not signed
--                                in and is not on leave.
--
-- AFTER DEPLOY: the founding Partner of each firm created before this change
-- has no Employee row, so their own hours were never tracked. New signups now
-- create one. Existing firms can be back-filled with:
--
--   INSERT INTO employees (id, "firmId", name, email, "userId", "isActive",
--                          "createdAt", "updatedAt")
--   SELECT gen_random_uuid()::text, u."firmId", u.name, u.email, u.id, true,
--          now(), now()
--     FROM users u
--    WHERE u.role = 'PARTNER'
--      AND NOT EXISTS (SELECT 1 FROM employees e WHERE e."userId" = u.id);
--
-- Verify — sessions still open, and what they have earned:
--   SELECT e.name, s."loginAt", s."lastActiveAt", s."activeMinutes"
--     FROM employee_sessions s JOIN employees e ON e.id = s."employeeId"
--    WHERE s."isActive" ORDER BY s."lastActiveAt";
--
-- Days that recorded a login and no hours — the old bug's footprint:
--   SELECT count(*) FROM attendance_records
--    WHERE "loginAt" IS NOT NULL AND COALESCE("workMinutes", 0) = 0;
