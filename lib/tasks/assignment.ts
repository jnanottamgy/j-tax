/**
 * Whether this is a sensible person to give this work to.
 *
 * Assignment checked nothing. Not that the assignee was still active, not that
 * they were in the country that week, not what they were already carrying — and
 * `checkAssigneeAvailability`, written to answer exactly this, was called from
 * nowhere. So the leave calendar existed and work was still routed to people
 * who were away.
 *
 * Everything here warns and nothing blocks. Covering somebody's leave by
 * assigning ahead is ordinary, and a hard stop on a busy assignee would simply
 * be worked around by leaving the task unassigned — which is strictly worse,
 * because nothing chases an unowned task.
 *
 * Pure: the caller does the lookups.
 */

export type AssignmentConcernKind =
  | "INACTIVE"
  | "ON_LEAVE_AT_DUE_DATE"
  | "OVER_CAPACITY"
  | "SELF_REVIEW"

export type AssignmentConcern = {
  kind: AssignmentConcernKind
  /** BLOCKING stops the save; WARN is shown and can be accepted. */
  severity: "BLOCKING" | "WARN"
  message: string
}

export type AssignmentCheckInput = {
  assigneeName: string
  isActive: boolean
  /** True when the assignee is on approved leave on the task's due date. */
  onLeaveAtDueDate: boolean
  /** Leave period covering the due date, for the message. */
  leaveLabel?: string | null
  /** Open tasks they already hold, due in the same window. */
  currentLoad?: number
  /** Working days they have available in that window. */
  workingDays?: number
  /** Set when this person is also the named reviewer for the task. */
  isOwnReviewer?: boolean
}

/** Tasks per available day past which a warning is worth showing. */
const BUSY_PER_DAY = 2.5

export function checkAssignment(input: AssignmentCheckInput): AssignmentConcern[] {
  const concerns: AssignmentConcern[] = []

  // The one genuine blocker: a disabled account cannot open the task at all,
  // so assigning to them is not a trade-off, it is losing the work.
  if (!input.isActive) {
    concerns.push({
      kind: "INACTIVE",
      severity: "BLOCKING",
      message: `${input.assigneeName}'s account is disabled — they cannot open this task.`,
    })
  }

  if (input.isOwnReviewer) {
    concerns.push({
      kind: "SELF_REVIEW",
      severity: "BLOCKING",
      message: `${input.assigneeName} is the named reviewer for this task and cannot review their own work.`,
    })
  }

  if (input.onLeaveAtDueDate) {
    concerns.push({
      kind: "ON_LEAVE_AT_DUE_DATE",
      severity: "WARN",
      message: `${input.assigneeName} is on leave${
        input.leaveLabel ? ` ${input.leaveLabel}` : ""
      }, which covers this due date.`,
    })
  }

  if (
    input.currentLoad != null &&
    input.workingDays != null &&
    input.currentLoad > 0
  ) {
    if (input.workingDays === 0) {
      concerns.push({
        kind: "OVER_CAPACITY",
        severity: "WARN",
        message: `${input.assigneeName} has no working days left in this period and already holds ${input.currentLoad}.`,
      })
    } else {
      const perDay = input.currentLoad / input.workingDays
      if (perDay >= BUSY_PER_DAY) {
        concerns.push({
          kind: "OVER_CAPACITY",
          severity: "WARN",
          message: `${input.assigneeName} already holds ${input.currentLoad} task${
            input.currentLoad === 1 ? "" : "s"
          } across ${input.workingDays} working day${
            input.workingDays === 1 ? "" : "s"
          } — about ${perDay.toFixed(1)} a day before this one.`,
        })
      }
    }
  }

  return concerns
}

/** Does anything here stop the save? */
export function hasBlocker(concerns: AssignmentConcern[]): boolean {
  return concerns.some((c) => c.severity === "BLOCKING")
}
