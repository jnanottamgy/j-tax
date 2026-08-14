-- 018_task_workflow.sql
--
-- Fixes the assignment and status chain.
--
-- BACKGROUND — two data problems, both one-way.
--
-- 1. A DECLINED task kept its assignee. declineTask set acceptanceStatus and
--    never touched assignedEmployeeId, so refused work stayed on the decliner's
--    plate — counted in their workload, shown on their board, and blocked:
--    every status change came back with "you declined this, a manager needs to
--    reassign it". Because it was still assigned it never reached the
--    unassigned queue either. Declining now releases the task, and these two
--    columns keep the record of who refused it and why.
--
-- 2. isOverdue and escalated only ever went true. There was no `isOverdue:
--    false` write anywhere in the codebase, so finishing a task or moving its
--    due date left it flagged late for ever and every workload count that read
--    the flag grew wrong week by week. Both are now derived from status and due
--    date on every write; the UPDATE below repairs the accumulated damage.
--
-- Idempotent: safe to run more than once.

BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS "declinedReasonCode"   TEXT,
  ADD COLUMN IF NOT EXISTS "declinedByEmployeeId" TEXT;

-- Repair the stuck overdue flags. A finished task is never overdue; an
-- unfinished one is overdue exactly when its due date has passed.
UPDATE tasks
   SET "isOverdue" = FALSE
 WHERE "isOverdue" = TRUE
   AND (status = 'FILED_DONE' OR "dueDate" IS NULL OR "dueDate" >= now());

-- Same for escalation: a finished task cannot be escalated, and leaving the
-- flag set means it can never escalate again if it is reopened and goes late.
UPDATE tasks
   SET escalated = FALSE, "escalationLevel" = 0
 WHERE escalated = TRUE
   AND status = 'FILED_DONE';

-- A reopened task carrying a completion date reads as complete while sitting in
-- an open status, and every "completed this period" figure counts it.
UPDATE tasks
   SET "completionDate" = NULL
 WHERE "completionDate" IS NOT NULL
   AND status <> 'FILED_DONE';

-- Release tasks already stranded by a decline: still assigned to whoever
-- refused them, and unable to move.
UPDATE tasks
   SET "assignedEmployeeId" = NULL,
       "declinedByEmployeeId" = COALESCE("declinedByEmployeeId", "assignedEmployeeId")
 WHERE "acceptanceStatus" = 'DECLINED'
   AND "assignedEmployeeId" IS NOT NULL
   AND status <> 'FILED_DONE';

-- The review queue asks "what is under review, and who is it named to?".
CREATE INDEX IF NOT EXISTS "tasks_under_review_idx"
  ON tasks ("reviewerEmployeeId")
  WHERE status = 'UNDER_REVIEW';

COMMIT;

-- Verify — flags that should no longer be stuck:
--   SELECT count(*) FILTER (WHERE "isOverdue" AND status = 'FILED_DONE')        AS done_but_overdue,
--          count(*) FILTER (WHERE "completionDate" IS NOT NULL
--                             AND status <> 'FILED_DONE')                      AS open_but_completed,
--          count(*) FILTER (WHERE "acceptanceStatus" = 'DECLINED'
--                             AND "assignedEmployeeId" IS NOT NULL)            AS stranded_declines
--     FROM tasks;
-- All three should be zero.
--
-- Why work is being refused, once the codes start filling in:
--   SELECT "declinedReasonCode", count(*) FROM tasks
--    WHERE "declinedReasonCode" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
