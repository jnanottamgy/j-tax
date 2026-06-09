import { addDays, addMonths, addYears } from "date-fns"
import type {
  Prisma,
  ServiceFrequency,
  ServiceType,
} from "@prisma/client"

import { SERVICE_TYPE_LABELS } from "@/lib/clients/constants"

type ServiceInput = {
  serviceType: ServiceType
  frequency: ServiceFrequency
  nextDueDate?: string
}

const DOCUMENT_CHECKLIST: Record<ServiceType, string[]> = {
  GST_RETURN: [
    "GST registration certificate",
    "Latest GSTR-1 and GSTR-3B filings",
    "Sales and purchase register",
    "Input tax credit reconciliation",
  ],
  TDS: [
    "TAN allotment letter",
    "Challan payment history",
    "Deductee master list",
    "Previous TDS returns",
  ],
  COMPANY_LAW: [
    "Certificate of incorporation",
    "MOA and AOA",
    "Director KYC documents",
    "Latest ROC annual filing",
  ],
  BOOKKEEPING: [
    "Bank statements",
    "Opening balance sheet",
    "Chart of accounts",
    "Purchase and sales invoices",
  ],
  AUDIT: [
    "Trial balance",
    "Fixed asset register",
    "Loan confirmations",
    "Previous audit report",
  ],
  INCOME_TAX: [
    "PAN card",
    "Previous income tax return",
    "Form 26AS/AIS",
    "Investment and deduction proofs",
  ],
  PAYROLL: [
    "Employee master data",
    "Salary structure",
    "PF/ESI registrations",
    "Attendance records",
  ],
  OTHER: [
    "Engagement scope note",
    "Client authorization letter",
    "Supporting documents",
  ],
}

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
  }
): {
  services: Prisma.ClientServiceCreateManyInput[]
  tasks: Prisma.TaskCreateManyInput[]
  complianceSchedules: Prisma.ComplianceScheduleCreateManyInput[]
  reminders: Prisma.ReminderCreateManyInput[]
} {
  const serviceRecords: Prisma.ClientServiceCreateManyInput[] = []
  const tasks: Prisma.TaskCreateManyInput[] = []
  const complianceSchedules: Prisma.ComplianceScheduleCreateManyInput[] = []
  const reminders: Prisma.ReminderCreateManyInput[] = []

  const now = new Date()
  const reminderDaysBefore = options?.reminderDaysBefore ?? 7
  const notificationLabel = options?.notificationPreferences?.length
    ? ` via ${options.notificationPreferences.join(", ")}`
    : ""

  for (const svc of services) {
    const nextDue = svc.nextDueDate
      ? new Date(svc.nextDueDate)
      : calculateNextDueDate(svc.frequency, now)
    const label = SERVICE_TYPE_LABELS[svc.serviceType]

    serviceRecords.push({
      clientId,
      serviceType: svc.serviceType,
      frequency: svc.frequency,
      nextDueDate: nextDue,
      isActive: true,
    })

    tasks.push({
      clientId,
      title: `Onboarding: ${label} setup`,
      description: `Initial ${label.toLowerCase()} workflow for ${clientName}`,
      status: "NOT_STARTED",
      dueDate: addDays(now, 7),
      serviceType: svc.serviceType,
    })

    tasks.push({
      clientId,
      title: `Collect documents for ${label}`,
      description: `Gather required filings and records for ${clientName}`,
      status: "NOT_STARTED",
      dueDate: addDays(now, 14),
      serviceType: svc.serviceType,
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

  return {
    services: serviceRecords,
    tasks,
    complianceSchedules,
    reminders,
  }
}

export function buildDocumentChecklist(services: ServiceInput[]): string[] {
  return Array.from(
    new Set(
      services.flatMap((service) => DOCUMENT_CHECKLIST[service.serviceType])
    )
  )
}
