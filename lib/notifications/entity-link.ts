import type { NotificationEntityType } from "@prisma/client"

/**
 * Resolve a notification's referenced entity to the best in-app destination.
 *
 * `entityType` and `entityId` have been written on every notification since the
 * beginning. The bell — the surface people actually use — read neither, so
 * "Task assigned: GSTR-3B for Patel Enterprises" dead-ended on the notifications
 * list and the user went to Work Tracker to find the row by hand. Multiply by
 * every assignment, decline, quotation response and overdue flag.
 *
 * Returns null when there is genuinely nowhere better than the list. A link
 * that lands on the wrong screen is worse than no link at all.
 */
export function notificationHref(
  entityType?: NotificationEntityType | null,
  entityId?: string | null
): string | null {
  const id = entityId?.trim() || null

  switch (entityType) {
    case "TASK":
      // Opens the task's own drawer — see the taskId deep link in
      // work-tracker-client. Without an id there is no row to open, so the
      // unfiltered list is the honest destination.
      return id ? `/work-tracker?taskId=${encodeURIComponent(id)}` : "/work-tracker"
    case "INVOICE":
      return id ? `/payments/invoices/${encodeURIComponent(id)}` : "/payments/invoices"
    case "CLIENT":
      return id ? `/clients/${encodeURIComponent(id)}` : "/clients"
    case "COMPLIANCE":
      return id ? `/compliance?eventId=${encodeURIComponent(id)}` : "/compliance"
    case "DOCUMENT":
      // No per-document route; the vault is the right screen even without the
      // exact row.
      return "/documents"
    case "PAYMENT":
      // Carries the payment's own id, not the invoice's, and there is no
      // per-payment screen to land on.
      return "/payments"
    case "USER":
      return id ? `/employees/${encodeURIComponent(id)}` : "/employees"
    default:
      return null
  }
}
