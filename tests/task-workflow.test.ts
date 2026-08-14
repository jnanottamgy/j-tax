/**
 * Task transitions and assignment checks.
 *
 * The flags these replace were one-way: isOverdue was set true by a nightly
 * cron and never once set back, escalated the same, and completionDate was
 * written when absent and never cleared. So a finished task stayed "overdue"
 * for ever, a reopened one still carried a completion date, and every workload
 * count that read them grew wrong week by week.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  canTransition,
  deriveTaskFlags,
  isDeclineReason,
  isTaskStatus,
  requiresReason,
} from "@/lib/tasks/transitions"
import { checkAssignment, hasBlocker } from "@/lib/tasks/assignment"

const NOW = new Date(2026, 5, 15, 12, 0)
const YESTERDAY = new Date(2026, 5, 14)
const NEXT_WEEK = new Date(2026, 5, 22)

describe("isTaskStatus", () => {
  test("accepts the real statuses and rejects anything else", () => {
    // The one status writer took a bare string and handed it to Prisma, so a
    // bad value surfaced as a raw enum error.
    assert.equal(isTaskStatus("IN_PROGRESS"), true)
    assert.equal(isTaskStatus("DONE"), false)
    assert.equal(isTaskStatus(""), false)
  })
})

describe("deriveTaskFlags", () => {
  test("finishing clears overdue, however late it was", () => {
    // The exact stuck flag: nothing anywhere wrote isOverdue: false.
    const f = deriveTaskFlags({ status: "FILED_DONE", dueDate: YESTERDAY, now: NOW })
    assert.equal(f.isOverdue, false)
  })

  test("finishing stamps a completion date", () => {
    const f = deriveTaskFlags({ status: "FILED_DONE", dueDate: NEXT_WEEK, now: NOW })
    assert.equal(f.completionDate?.getTime(), NOW.getTime())
  })

  test("re-saving a finished task keeps the original completion date", () => {
    // Re-filing must not rewrite when the work was actually done.
    const original = new Date(2026, 4, 1)
    const f = deriveTaskFlags({
      status: "FILED_DONE",
      dueDate: NEXT_WEEK,
      now: NOW,
      existingCompletionDate: original,
    })
    assert.equal(f.completionDate?.getTime(), original.getTime())
  })

  test("reopening clears the completion date", () => {
    // It used to survive, so a reopened task read as complete while sitting in
    // an open status and every "completed this period" figure counted it.
    const f = deriveTaskFlags({
      status: "IN_PROGRESS",
      dueDate: NEXT_WEEK,
      now: NOW,
      existingCompletionDate: new Date(2026, 4, 1),
    })
    assert.equal(f.completionDate, null)
  })

  test("reopening clears escalation so it can escalate again", () => {
    const f = deriveTaskFlags({ status: "IN_PROGRESS", dueDate: YESTERDAY, now: NOW })
    assert.equal(f.escalated, false)
    assert.equal(f.escalationLevel, 0)
  })

  test("an unfinished task past its due date is overdue", () => {
    const f = deriveTaskFlags({ status: "IN_PROGRESS", dueDate: YESTERDAY, now: NOW })
    assert.equal(f.isOverdue, true)
  })

  test("moving the due date forward clears overdue by itself", () => {
    // The reason these are derived rather than toggled: extending a deadline
    // used to leave the task marked late for ever.
    const f = deriveTaskFlags({ status: "IN_PROGRESS", dueDate: NEXT_WEEK, now: NOW })
    assert.equal(f.isOverdue, false)
  })

  test("no due date is never overdue", () => {
    const f = deriveTaskFlags({ status: "IN_PROGRESS", dueDate: null, now: NOW })
    assert.equal(f.isOverdue, false)
  })
})

describe("canTransition", () => {
  test("ordinary moves are allowed, including backwards", () => {
    // A practice is not a state machine — corrected figures arrive and work
    // genuinely goes back. Refusing that is how people work around an app.
    assert.equal(canTransition("UNDER_REVIEW", "IN_PROGRESS").allowed, true)
    assert.equal(canTransition("IN_PROGRESS", "DATA_AWAITED").allowed, true)
  })

  test("filed work can be reopened, but not to Not Started", () => {
    assert.equal(canTransition("FILED_DONE", "IN_PROGRESS").allowed, true)
    const v = canTransition("FILED_DONE", "NOT_STARTED")
    assert.equal(v.allowed, false)
    assert.match(v.allowed === false ? v.reason : "", /already done and filed/)
  })

  test("a no-op is refused rather than silently written", () => {
    assert.equal(canTransition("IN_PROGRESS", "IN_PROGRESS").allowed, false)
  })
})

describe("requiresReason", () => {
  test("sending work back needs one", () => {
    // "Check the task comments" with no comment is the standard complaint
    // about review workflows, and nothing required a comment.
    assert.equal(requiresReason("UNDER_REVIEW", "IN_PROGRESS"), true)
  })

  test("approving does not", () => {
    assert.equal(requiresReason("UNDER_REVIEW", "FILED_DONE"), false)
  })

  test("reopening filed work needs one", () => {
    assert.equal(requiresReason("FILED_DONE", "IN_PROGRESS"), true)
  })

  test("ordinary progress does not", () => {
    assert.equal(requiresReason("NOT_STARTED", "IN_PROGRESS"), false)
  })
})

describe("decline reasons", () => {
  test("known codes are accepted, anything else is not", () => {
    assert.equal(isDeclineReason("NO_CAPACITY"), true)
    assert.equal(isDeclineReason("BECAUSE"), false)
  })
})

describe("checkAssignment", () => {
  const base = { assigneeName: "Asha", isActive: true, onLeaveAtDueDate: false }

  test("a healthy assignment raises nothing", () => {
    assert.deepEqual(checkAssignment(base), [])
  })

  test("a disabled account blocks — the work would simply be lost", () => {
    const c = checkAssignment({ ...base, isActive: false })
    assert.equal(hasBlocker(c), true)
    assert.equal(c[0].kind, "INACTIVE")
  })

  test("leave over the due date warns but does not block", () => {
    // Assigning ahead to cover somebody's leave is ordinary; a hard stop would
    // just be worked around by leaving the task unassigned, which is worse.
    const c = checkAssignment({ ...base, onLeaveAtDueDate: true, leaveLabel: "from 01 Jul to 10 Jul" })
    assert.equal(hasBlocker(c), false)
    assert.equal(c[0].kind, "ON_LEAVE_AT_DUE_DATE")
    assert.match(c[0].message, /01 Jul/)
  })

  test("a heavy load warns with the arithmetic shown", () => {
    const c = checkAssignment({ ...base, currentLoad: 20, workingDays: 5 })
    assert.equal(c[0].kind, "OVER_CAPACITY")
    assert.match(c[0].message, /4\.0 a day/)
  })

  test("a comfortable load says nothing", () => {
    assert.deepEqual(checkAssignment({ ...base, currentLoad: 4, workingDays: 5 }), [])
  })

  test("no working days left is called out rather than dividing by zero", () => {
    const c = checkAssignment({ ...base, currentLoad: 3, workingDays: 0 })
    assert.equal(c[0].kind, "OVER_CAPACITY")
    assert.match(c[0].message, /no working days/)
  })

  test("somebody cannot be assigned work they are the named reviewer for", () => {
    // The review gate exists to stop people signing off their own work; this
    // catches it when the assignment is made rather than when it is filed.
    const c = checkAssignment({ ...base, isOwnReviewer: true })
    assert.equal(hasBlocker(c), true)
  })
})
