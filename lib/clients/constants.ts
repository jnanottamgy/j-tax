import type {
  ClientPriority,
  ClientStatus,
  ServiceFrequency,
  ServiceType,
} from "@prisma/client"

export const PAGE_SIZE = 8

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PENDING: "Pending",
  ON_HOLD: "On Hold",
}

/**
 * What each status actually does.
 *
 * These render as a coloured chip and nothing else, so nobody could tell that
 * three of the four switch off automatic compliance. That is exactly how every
 * client sat on PENDING with no filings being generated and no one noticing —
 * a status with a visible consequence would have shown it on day one.
 *
 * `generatesFilings` mirrors the query in generateRecurringComplianceTasks: it
 * serves ACTIVE and nothing else.
 */
export const CLIENT_STATUS_MEANING: Record<
  ClientStatus,
  { generatesFilings: boolean; consequence: string }
> = {
  ACTIVE: {
    generatesFilings: true,
    consequence: "Deadlines and filing tasks are generated automatically each month.",
  },
  PENDING: {
    generatesFilings: false,
    consequence:
      "No deadlines or filing tasks are generated. Use this only before an engagement has started.",
  },
  ON_HOLD: {
    generatesFilings: false,
    consequence:
      "No deadlines or filing tasks are generated while the engagement is paused. Existing work stays.",
  },
  INACTIVE: {
    generatesFilings: false,
    consequence: "No deadlines or filing tasks are generated. Use this when the client has left.",
  },
}

/** One-line summary for a chip tooltip or a form hint. */
export function clientStatusHint(status: ClientStatus): string {
  return CLIENT_STATUS_MEANING[status].consequence
}

export const CLIENT_PRIORITY_LABELS: Record<ClientPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  GST_RETURN: "GST",
  INCOME_TAX: "Income Tax",
  TDS: "TDS",
  PAYROLL: "Payroll",
  BOOKKEEPING: "Bookkeeping",
  AUDIT: "Audit",
  COMPANY_LAW: "ROC",
  INCORPORATION: "Incorporation",
  OTHER: "Other",
}

export const SERVICE_FREQUENCY_LABELS: Record<ServiceFrequency, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
  ONE_TIME: "One-time",
}

export const ALL_SERVICE_TYPES = Object.keys(
  SERVICE_TYPE_LABELS
) as ServiceType[]

/**
 * Display name for a service. For OTHER, use the client-supplied custom name
 * (e.g. "Trademark filing") when present; otherwise fall back to the enum
 * label. Use this everywhere a service is shown so "OTHER" never renders as a
 * bare, meaningless "Other".
 */
export function serviceLabel(
  serviceType: ServiceType,
  customName?: string | null
): string {
  if (serviceType === "OTHER") {
    const trimmed = customName?.trim()
    if (trimmed) return trimmed
  }
  return SERVICE_TYPE_LABELS[serviceType]
}

export const ALL_CLIENT_STATUSES = Object.keys(
  CLIENT_STATUS_LABELS
) as ClientStatus[]

export const ALL_CLIENT_PRIORITIES = Object.keys(
  CLIENT_PRIORITY_LABELS
) as ClientPriority[]

/** UI-friendly lowercase keys for badges (maps from Prisma enums) */
export type ClientStatusKey = Lowercase<ClientStatus>
export type ClientPriorityKey = Lowercase<ClientPriority>

export function statusToKey(status: ClientStatus): ClientStatusKey {
  return status.toLowerCase() as ClientStatusKey
}

export function priorityToKey(priority: ClientPriority): ClientPriorityKey {
  return priority.toLowerCase() as ClientPriorityKey
}
