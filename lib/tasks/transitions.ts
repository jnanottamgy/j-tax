/**
 * What a status change means, and what has to change with it.
 *
 * `updateTaskStatus` took a bare string, wrote it, and set a completion date if
 * one was not already there. Everything else was left to drift:
 *
 *   - `isOverdue` was set to true by a nightly cron and never once set back.
 *     No `isOverdue: false` write existed anywhere in the codebase, so
 *     finishing a task, or moving its due date, left the flag on for ever and
 *     every workload report that counted it grew wrong week by week.
 *   - `escalated` had the same one-way problem, so a task escalated once could
 *     never escalate again however late it got the second time.
 *   - Nothing stopped FILED_DONE → NOT_STARTED, and `completionDate` was only
 *     written `if (!task.completionDate)` and never cleared — so a reopened
 *     task carried a completion date while sitting in an open status, and every
 *     "completed this period" figure counted it.
 *
 * The fix is to stop treating these as flags somebody remembers to maintain and
 * derive them from the two facts that decide them: the status, and the due date.
 *
 * Pure — no database, no clock of its own.
 */

export const TASK_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DATA_AWAITED",
  "UNDER_REVIEW",
  "FILED_DONE",
  "ON_HOLD",
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/** Is this a status the app actually has? */
export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value)
}

/** Statuses that mean the work is finished. */
export const TERMINAL_STATUSES: TaskStatus[] = ["FILED_DONE"]

export const isTerminal = (status: TaskStatus): boolean =>
  TERMINAL_STATUSES.includes(status)

export type TaskFlags = {
  isOverdue: boolean
  /** Set when entering a terminal status, cleared when leaving one. */
  completionDate: Date | null
  /** Reset on reopen so a task can escalate again if it goes late twice. */
  escalated: boolean
  escalationLevel: number
}

/**
 * The flags that follow from a status and a due date.
 *
 * Derived every time, rather than toggled and hoped over. A finished task is
 * never overdue no matter how late it was; an unfinished one is overdue exactly
 * when its due date has passed, which means moving the date fixes the flag
 * automatically instead of leaving it stuck on.
 */
export function deriveTaskFlags(input: {
  status: TaskStatus
  dueDate: Date | null | undefined
  now: Date
  /** The existing completion date, kept when the task was already finished. */
  existingCompletionDate?: Date | null
}): TaskFlags {
  const finished = isTerminal(input.status)

  if (finished) {
    return {
      isOverdue: false,
      // Keep the original completion date on a re-save; only stamp a new one
      // the first time it is finished, so re-filing does not rewrite history.
      completionDate: input.existingCompletionDate ?? input.now,
      escalated: false,
      escalationLevel: 0,
    }
  }

  return {
    isOverdue: Boolean(input.dueDate && input.dueDate < input.now),
    // Reopened work is not finished work. Leaving the date behind is what made
    // a task read as complete while sitting in an open status.
    completionDate: null,
    escalated: false,
    escalationLevel: 0,
  }
}

export type TransitionVerdict = { allowed: true } | { allowed: false; reason: string }

/**
 * Is this move legal at all?
 *
 * Deliberately permissive. A practice is not a state machine — work genuinely
 * goes backwards when a client sends corrected figures, and an app that refuses
 * is one people work around. Only two moves are stopped, both because they
 * discard information rather than change state.
 */
export function canTransition(from: TaskStatus, to: TaskStatus): TransitionVerdict {
  if (from === to) {
    return { allowed: false, reason: "That is already the status." }
  }

  // Reopening is allowed, but not straight to "not started": the work exists
  // and someone did it. Sending it back to IN_PROGRESS or DATA_AWAITED says
  // what happens next; NOT_STARTED erases that it ever happened.
  if (from === "FILED_DONE" && to === "NOT_STARTED") {
    return {
      allowed: false,
      reason:
        "Reopen it as In Progress or Data Awaited — Not Started would lose the fact that the work was already done and filed.",
    }
  }

  return { allowed: true }
}

/** Does this move need a written reason? */
export function requiresReason(from: TaskStatus, to: TaskStatus): boolean {
  // Sending work back is the one transition people complain about most in
  // review workflows, and "check the comments" with no comment is why.
  if (from === "UNDER_REVIEW" && to !== "FILED_DONE") return true
  // Reopening something already filed is a big deal and needs to say why.
  if (from === "FILED_DONE") return true
  return false
}

export const DECLINE_REASONS = [
  { value: "NO_CAPACITY", label: "No capacity this week" },
  { value: "NOT_MY_CLIENT", label: "Not my client" },
  { value: "WRONG_SKILL", label: "Outside what I do" },
  { value: "NEEDS_INFO", label: "Not enough information to start" },
  { value: "ON_LEAVE", label: "I'm away when this is due" },
  { value: "OTHER", label: "Something else" },
] as const

export type DeclineReasonCode = (typeof DECLINE_REASONS)[number]["value"]

export function isDeclineReason(value: string): value is DeclineReasonCode {
  return DECLINE_REASONS.some((r) => r.value === value)
}
