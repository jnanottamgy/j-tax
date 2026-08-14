/**
 * What a status actually *does*, as opposed to what it is called.
 *
 * Every status chip in the app carried a colour and a label and nothing else.
 * Colour encodes a mood, not a rule, and the rules here are not guessable: a
 * task sitting in UNDER_REVIEW stops raising overdue alerts, an ON_HOLD task
 * also drops out of its owner's workload, and a WAIVED invoice quietly leaves
 * the client's outstanding balance. Somebody choosing a status from a dropdown
 * was choosing a behaviour they could not see.
 *
 * Each entry states the consequence in the words a partner would use, and
 * `automated` marks the statuses where the app stops doing something on its
 * own — that is the distinction worth showing on the chip itself, because it
 * is the one that turns into a missed deadline.
 *
 * Every line here is checked against the code that reads the status:
 *   - overdue alerts: app/api/cron/reminders/route.ts (NOT_STARTED,
 *     IN_PROGRESS, DATA_AWAITED only)
 *   - workload: app/actions/workforce.ts (excludes FILED_DONE and ON_HOLD)
 *   - payments: app/actions/invoices.ts (refused on PAID, WAIVED, DISPUTED)
 *   - outstanding: app/actions/invoices.ts (excludes WAIVED)
 * If one of those changes, the sentence here is wrong and must change with it.
 */

import { CLIENT_STATUS_MEANING } from "@/lib/clients/constants"

export type StatusMeaning = {
  /** One line, stating the effect rather than restating the name. */
  consequence: string
  /**
   * False when the app stops doing something automatic in this status —
   * reminders, alerts, chasing. The chip marks these so the quiet ones are
   * visible at a glance.
   */
  automated: boolean
}

export type TaskStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DATA_AWAITED"
  | "UNDER_REVIEW"
  | "FILED_DONE"
  | "ON_HOLD"

export const TASK_STATUS_MEANING: Record<TaskStatus, StatusMeaning> = {
  NOT_STARTED: {
    consequence:
      "Counts as open work, and raises an overdue alert to the assignee once the due date passes.",
    automated: true,
  },
  IN_PROGRESS: {
    consequence:
      "Counts as open work, and raises an overdue alert to the assignee once the due date passes.",
    automated: true,
  },
  DATA_AWAITED: {
    consequence:
      "Waiting on the client — but the due date still runs, and an overdue alert is still raised. Chase the client; the deadline does not move.",
    automated: true,
  },
  UNDER_REVIEW: {
    consequence:
      "Waiting on a reviewer. No overdue alert is raised while a task sits here, so a review that stalls goes quiet.",
    automated: false,
  },
  FILED_DONE: {
    consequence:
      "Closed. Stamps the completion date, releases any task waiting on this one, and stops counting as open work.",
    automated: true,
  },
  ON_HOLD: {
    consequence:
      "Parked. No overdue alert is raised, and the task drops out of its owner's workload — so nothing will remind anyone it exists.",
    automated: false,
  },
}

export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "DISPUTED"
  | "WAIVED"

export const INVOICE_STATUS_MEANING: Record<InvoiceStatus, StatusMeaning> = {
  DRAFT: {
    consequence: "Not issued to the client yet, and not chased. Nothing leaves the firm in this state.",
    automated: false,
  },
  SENT: {
    consequence: "Issued and outstanding. Counts towards receivables and is chased as it ages.",
    automated: true,
  },
  PARTIALLY_PAID: {
    consequence: "Part-settled. The remaining balance stays outstanding and keeps being chased.",
    automated: true,
  },
  PAID: {
    consequence: "Settled in full. No further payment can be recorded against it.",
    automated: true,
  },
  OVERDUE: {
    consequence: "Past its due date and still outstanding. Counts towards receivables.",
    automated: true,
  },
  DISPUTED: {
    consequence:
      "The client is contesting it. Payments cannot be recorded until the dispute is resolved, but it stays in receivables.",
    automated: false,
  },
  WAIVED: {
    consequence:
      "Written off. Payments cannot be recorded, and the amount leaves the client's outstanding balance — this is money given up, not money deferred.",
    automated: false,
  },
}

export type ComplianceEventStatus = "PENDING" | "COMPLETED" | "OVERDUE" | "CANCELLED"

export const COMPLIANCE_STATUS_MEANING: Record<ComplianceEventStatus, StatusMeaning> = {
  PENDING: {
    consequence:
      "Due and unfiled. The client is emailed a reminder in the week before the deadline, and the assignee is notified.",
    automated: true,
  },
  COMPLETED: {
    consequence: "Filed for this period. No further reminders go out for it.",
    automated: true,
  },
  OVERDUE: {
    consequence:
      "The deadline has passed and it is still unfiled. Reminders continue, and interest or late fees are likely already accruing.",
    automated: true,
  },
  CANCELLED: {
    consequence:
      "Dropped for this period — no reminder is sent and nobody is alerted. Use this only when the filing genuinely does not apply.",
    automated: false,
  },
}

/**
 * The client-status map in the shared shape.
 *
 * `generatesFilings` is the same idea as `automated` — whether the app keeps
 * working on this record on its own — so the two are adapted rather than
 * restated. Client status keeps its own richer map because the edit form uses
 * that flag directly.
 */
export const CLIENT_STATUS_MEANING_FOR_BADGE: Record<string, StatusMeaning> =
  Object.fromEntries(
    Object.entries(CLIENT_STATUS_MEANING).map(([status, m]) => [
      status,
      { consequence: m.consequence, automated: m.generatesFilings },
    ])
  )

/**
 * Lookup that tolerates a status string the map does not cover.
 *
 * Deliberately typed against a partial record: the caller picks a map by
 * domain at runtime, so the key type is not known statically, and an
 * unrecognised status must render as a plain chip rather than crash.
 */
export function statusMeaning(
  map: Partial<Record<string, StatusMeaning>>,
  status: string
): StatusMeaning | null {
  return map[status] ?? null
}
