import { addDays, addMonths, addYears } from "date-fns"
import type {
  Prisma,
  ServiceFrequency,
  ServiceType,
} from "@prisma/client"

import { serviceLabel } from "@/lib/clients/constants"

type ServiceInput = {
  serviceType: ServiceType
  frequency: ServiceFrequency
  nextDueDate?: string
  /** Name when serviceType is OTHER. */
  customName?: string
  /** Agreed fee per billing occurrence, excluding GST. */
  agreedFee?: number
  /** Defaults to the filing `frequency` when not set explicitly. */
  billingFrequency?: ServiceFrequency
  /** The quotation line the fee came from. */
  sourceQuotationItemId?: string
}

/**
 * Fixed onboarding document checklist. Per product decision the checklist is no
 * longer derived from the client's service mix — only these two standard docs
 * are offered by default, plus any "Other" documents the user types in.
 */
export const BASE_DOCUMENT_CHECKLIST = [
  "Engagement Letter",
  "Client Authorization Letter",
] as const

export function calculateNextDueDate(
  frequency: ServiceFrequency,
  from: Date = new Date()
): Date {
  switch (frequency) {
    case "MONTHLY":
      return addMonths(from, 1)
    case "QUARTERLY":
      return addMonths(from, 3)
    case "ANNUAL":
      return addYears(from, 1)
    case "ONE_TIME":
      return addDays(from, 30)
    default:
      return addDays(from, 30)
  }
}

export function buildOnboardingArtifacts(
  clientId: string,
  clientName: string,
  services: ServiceInput[],
  options?: {
    reminderDaysBefore?: number
    notificationPreferences?: string[]
    /** Checklist document labels already collected at onboarding. */
    collectedDocuments?: string[]
    /**
     * Who owns this client. Onboarding tasks used to be created with no
     * assignee at all, even though the client record had one — so a four-service
     * client dropped eight items into the "Nobody assigned" queue on day one and
     * somebody had to hand-assign work that already had an obvious owner.
     */
    assignedEmployeeId?: string | null
  }
): {
  services: Prisma.ClientServiceCreateManyInput[]
  tasks: Prisma.TaskCreateManyInput[]
  complianceSchedules: Prisma.ComplianceScheduleCreateManyInput[]
  reminders: Prisma.ReminderCreateManyInput[]
  documentChecklist: Prisma.ClientDocumentChecklistItemCreateManyInput[]
} {
  const serviceRecords: Prisma.ClientServiceCreateManyInput[] = []
  const tasks: Prisma.TaskCreateManyInput[] = []
  const complianceSchedules: Prisma.ComplianceScheduleCreateManyInput[] = []
  const reminders: Prisma.ReminderCreateManyInput[] = []
  const collectedSet = new Set(options?.collectedDocuments ?? [])

  const now = new Date()
  const reminderDaysBefore = options?.reminderDaysBefore ?? 7
  const assignedEmployeeId = options?.assignedEmployeeId ?? null
  // Assigned work waits to be accepted; unassigned work has nobody to accept
  // it, so it starts ACCEPTED — the same convention createTask uses.
  const acceptanceStatus = assignedEmployeeId ? ("PENDING" as const) : ("ACCEPTED" as const)
  const notificationLabel = options?.notificationPreferences?.length
    ? ` via ${options.notificationPreferences.join(", ")}`
    : ""

  for (const svc of services) {
    const nextDue = svc.nextDueDate
      ? new Date(svc.nextDueDate)
      : calculateNextDueDate(svc.frequency, now)
    const label = serviceLabel(svc.serviceType, svc.customName)

    // The ClientService row IS the engagement: this client, this service, at
    // this fee, on this cycle. Recording the fee here is what lets the firm
    // later ask whether it is billing what it quoted.
    const hasFee = typeof svc.agreedFee === "number" && svc.agreedFee > 0

    serviceRecords.push({
      clientId,
      serviceType: svc.serviceType,
      customName: svc.serviceType === "OTHER" ? svc.customName ?? null : null,
      frequency: svc.frequency,
      nextDueDate: nextDue,
      isActive: true,
      agreedFee: hasFee ? svc.agreedFee : null,
      billingFrequency: svc.billingFrequency ?? null,
      sourceQuotationItemId: svc.sourceQuotationItemId ?? null,
      feeAgreedAt: hasFee ? now : null,
    })

    tasks.push({
      clientId,
      title: `Onboarding: ${label} setup`,
      description: `Initial ${label.toLowerCase()} workflow for ${clientName}`,
      status: "NOT_STARTED",
      dueDate: addDays(now, 7),
      serviceType: svc.serviceType,
      assignedEmployeeId,
      acceptanceStatus,
    })

    tasks.push({
      clientId,
      title: `Collect documents for ${label}`,
      description: `Gather required filings and records for ${clientName}`,
      status: "NOT_STARTED",
      dueDate: addDays(now, 14),
      serviceType: svc.serviceType,
      assignedEmployeeId,
      acceptanceStatus,
    })

    complianceSchedules.push({
      clientId,
      title: `${label} compliance cycle`,
      jurisdiction: "India",
      dueDate: nextDue,
      status: "SCHEDULED",
      serviceType: svc.serviceType,
    })

    reminders.push({
      clientId,
      title: `Upcoming ${label} deadline${notificationLabel}`,
      dueAt: addDays(nextDue, -reminderDaysBefore),
      sent: false,
    })

  }

  const now2 = new Date()
  // Checklist rows = the fixed base docs + any custom "Other" docs the user
  // typed in (these arrive through collectedDocuments and are shown as
  // collected). Preserve order and de-dupe.
  const customLabels = [...collectedSet].filter(
    (l) => !BASE_DOCUMENT_CHECKLIST.includes(l as (typeof BASE_DOCUMENT_CHECKLIST)[number])
  )
  const checklistLabels = Array.from(
    new Set<string>([...BASE_DOCUMENT_CHECKLIST, ...customLabels])
  )
  const documentChecklist: Prisma.ClientDocumentChecklistItemCreateManyInput[] =
    checklistLabels.map((label) => ({
      clientId,
      label,
      collected: collectedSet.has(label),
      collectedAt: collectedSet.has(label) ? now2 : null,
    }))

  return {
    services: serviceRecords,
    tasks,
    complianceSchedules,
    reminders,
    documentChecklist,
  }
}

/**
 * The default document checklist. No longer service-derived — always the fixed
 * base list. Custom "Other" documents are added by the user, not generated here.
 */
export function buildDocumentChecklist(_services?: ServiceInput[]): string[] {
  return [...BASE_DOCUMENT_CHECKLIST]
}
