import type { NotificationEntityType } from "@prisma/client"

/**
 * Resolve a notification's referenced entity to the best in-app destination.
 * Invoices and clients have dedicated detail routes so we deep-link precisely;
 * the remaining entity types route to their relevant list/workspace page.
 * Returns null when there's nothing meaningful to open.
 */
export function notificationHref(
  entityType?: NotificationEntityType | null,
  entityId?: string | null
): string | null {
  switch (entityType) {
    case "INVOICE":
      return entityId ? `/payments/invoices/${entityId}` : "/payments/invoices"
    case "PAYMENT":
      return "/payments"
    case "CLIENT":
      return entityId ? `/clients/${entityId}` : "/clients"
    case "TASK":
      return "/work-tracker"
    case "COMPLIANCE":
      return "/compliance"
    case "USER":
      return entityId ? `/employees/${entityId}` : "/employees"
    default:
      return null
  }
}
