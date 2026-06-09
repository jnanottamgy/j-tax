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
