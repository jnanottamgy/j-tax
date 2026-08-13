/**
 * Who may sign off what.
 *
 * Two decisions that were previously buried inline in their server actions,
 * where they could not be tested and were easy to get subtly wrong. Both are
 * pure: role in, verdict out.
 */

import type { AppRole } from "@/lib/auth/types"

export type SignOffVerdict = { allowed: true } | { allowed: false; reason: string }

/**
 * Can this person move a task to FILED_DONE?
 *
 * The rule the review step exists to enforce is that nobody signs off their own
 * work. That was only applied to EMPLOYEEs, so a Manager holding a task could
 * prepare a filing and approve it themselves — the exact separation-of-duties
 * failure a peer review looks for first.
 *
 * A Partner is the terminal authority. There is nobody above them to escalate
 * to, so blocking them would leave a single-partner firm unable to file at all.
 */
export function canSignOffTask(input: {
  role: AppRole
  /** The Employee record linked to the actor, if any. */
  actorEmployeeId: string | null
  assignedEmployeeId: string | null
}): SignOffVerdict {
  const { role, actorEmployeeId, assignedEmployeeId } = input

  if (role === "EMPLOYEE") {
    return {
      allowed: false,
      reason:
        'Submit it as "Under Review" instead — a Manager or Partner signs off Filed/Done.',
    }
  }

  if (role === "CLIENT") {
    return { allowed: false, reason: "Only firm staff can file work." }
  }

  if (
    role === "MANAGER" &&
    actorEmployeeId != null &&
    assignedEmployeeId === actorEmployeeId
  ) {
    return {
      allowed: false,
      reason:
        "This is your own work — a Partner has to sign it off. Leave it Under Review and it will show in their approval queue.",
    }
  }

  return { allowed: true }
}

/**
 * Does an invoice of this value, raised by this role, need a Partner's release?
 *
 * A Partner IS the approving authority, so their own invoices are never held —
 * otherwise nobody could ever release the first one. A null or non-positive
 * limit means the firm has not set a ceiling.
 */
export function invoiceNeedsApproval(input: {
  role: AppRole
  /** Invoice value including GST — what actually leaves the client's account. */
  totalAmount: number
  limit: number | null
}): boolean {
  const { role, totalAmount, limit } = input

  if (role === "PARTNER") return false
  if (limit == null || limit <= 0) return false
  if (!Number.isFinite(totalAmount)) return false

  // Strictly greater than: a limit of ₹1,00,000 means an invoice for exactly
  // that much is still within what a Manager may issue.
  return totalAmount > limit
}
