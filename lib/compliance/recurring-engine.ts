import { prisma } from "@/lib/prisma"
import { addMonths, addDays, startOfMonth, format } from "date-fns"

const DEFAULT_TEMPLATES = [
  // Accounting — Monthly
  { serviceType: "BOOKKEEPING" as const, complianceType: "CUSTOM" as const, title: "Collect Bank Statements", frequency: "MONTHLY" as const, dueDayOfMonth: 5, reminderDays: 3 },
  { serviceType: "BOOKKEEPING" as const, complianceType: "CUSTOM" as const, title: "Collect Sales Data", frequency: "MONTHLY" as const, dueDayOfMonth: 7, reminderDays: 3 },
  { serviceType: "BOOKKEEPING" as const, complianceType: "CUSTOM" as const, title: "Collect Purchase Data", frequency: "MONTHLY" as const, dueDayOfMonth: 7, reminderDays: 3 },
  { serviceType: "BOOKKEEPING" as const, complianceType: "CUSTOM" as const, title: "Collect Expense Receipts", frequency: "MONTHLY" as const, dueDayOfMonth: 10, reminderDays: 5 },

  // GST — Monthly
  { serviceType: "GST_RETURN" as const, complianceType: "GSTR_1" as const, title: "GSTR-1 Data Collection", frequency: "MONTHLY" as const, dueDayOfMonth: 5, reminderDays: 5 },
  { serviceType: "GST_RETURN" as const, complianceType: "GSTR_1" as const, title: "GSTR-1 Reconciliation & Filing", frequency: "MONTHLY" as const, dueDayOfMonth: 11, reminderDays: 3 },
  { serviceType: "GST_RETURN" as const, complianceType: "GSTR_3B" as const, title: "GSTR-3B Data Collection", frequency: "MONTHLY" as const, dueDayOfMonth: 10, reminderDays: 5 },
  { serviceType: "GST_RETURN" as const, complianceType: "GSTR_3B" as const, title: "GSTR-3B Reconciliation & Filing", frequency: "MONTHLY" as const, dueDayOfMonth: 20, reminderDays: 3 },

  // Income Tax — Annual
  { serviceType: "INCOME_TAX" as const, complianceType: "ITR" as const, title: "Tax Planning Review", frequency: "ANNUAL" as const, dueDayOfMonth: 1, reminderDays: 30 },
  { serviceType: "INCOME_TAX" as const, complianceType: "ITR" as const, title: "Advance Tax Computation (Q1)", frequency: "QUARTERLY" as const, dueDayOfMonth: 15, reminderDays: 10 },
  { serviceType: "INCOME_TAX" as const, complianceType: "ITR" as const, title: "ITR Filing", frequency: "ANNUAL" as const, dueDayOfMonth: 31, reminderDays: 30 },

  // TDS — Monthly
  { serviceType: "TDS" as const, complianceType: "TDS" as const, title: "TDS Return Filing", frequency: "MONTHLY" as const, dueDayOfMonth: 7, reminderDays: 5 },

  // Audit — Annual
  { serviceType: "AUDIT" as const, complianceType: "AUDIT" as const, title: "Audit Documentation Collection", frequency: "ANNUAL" as const, dueDayOfMonth: 1, reminderDays: 30 },
  { serviceType: "AUDIT" as const, complianceType: "AUDIT" as const, title: "Financial Statement Preparation", frequency: "ANNUAL" as const, dueDayOfMonth: 15, reminderDays: 14 },

  // Payroll — Monthly
  { serviceType: "PAYROLL" as const, complianceType: "PF_ESIC" as const, title: "PF/ESIC Return Filing", frequency: "MONTHLY" as const, dueDayOfMonth: 15, reminderDays: 5 },

  // ROC — Annual
  { serviceType: "COMPANY_LAW" as const, complianceType: "ROC" as const, title: "Annual ROC Filing", frequency: "ANNUAL" as const, dueDayOfMonth: 30, reminderDays: 30 },
]

export async function seedDefaultTemplates() {
  for (const tmpl of DEFAULT_TEMPLATES) {
    await prisma.recurringComplianceTemplate.upsert({
      where: {
        serviceType_complianceType_title: {
          serviceType: tmpl.serviceType,
          complianceType: tmpl.complianceType,
          title: tmpl.title,
        },
      },
      update: {},
      create: tmpl,
    })
  }
}

export async function generateRecurringComplianceTasks(): Promise<{ created: number; errors: string[] }> {
  const templates = await prisma.recurringComplianceTemplate.findMany({
    where: { isActive: true },
  })

  const clientsWithServices = await prisma.clientService.findMany({
    where: { isActive: true },
    include: { client: { select: { id: true, name: true, assignedEmployeeId: true, status: true } } },
  })

  const now = new Date()
  const targetMonth = addMonths(startOfMonth(now), 1)
  const filingPeriod = format(targetMonth, "MMM yyyy")

  let created = 0
  const errors: string[] = []

  for (const tmpl of templates) {
    const relevantClients = clientsWithServices.filter(
      (cs) => cs.serviceType === tmpl.serviceType && cs.client.status === "ACTIVE"
    )

    for (const cs of relevantClients) {
      const dueDate = computeDueDate(tmpl.frequency, tmpl.dueDayOfMonth, targetMonth)
      if (!dueDate) continue

      const existingEvent = await prisma.complianceEvent.findFirst({
        where: {
          clientId: cs.clientId,
          title: tmpl.title,
          filingPeriod,
        },
      })

      if (existingEvent) continue

      try {
        const event = await prisma.complianceEvent.create({
          data: {
            clientId: cs.clientId,
            type: tmpl.complianceType,
            title: tmpl.title,
            description: tmpl.description || `Auto-generated from ${tmpl.serviceType} service`,
            dueDate,
            status: "PENDING",
            workflowStatus: "NOT_STARTED",
            isStatutory: tmpl.complianceType !== "CUSTOM",
            reminderDays: tmpl.reminderDays,
            filingPeriod,
          },
        })

        await prisma.task.create({
          data: {
            clientId: cs.clientId,
            title: `${tmpl.title} — ${cs.client.name}`,
            description: `Auto-generated compliance task for ${filingPeriod}`,
            status: "NOT_STARTED",
            priority: "MEDIUM",
            dueDate,
            serviceType: tmpl.serviceType,
            assignedEmployeeId: cs.client.assignedEmployeeId || null,
            complianceEvents: { connect: { id: event.id } },
          },
        })

        if (cs.client.assignedEmployeeId) {
          const employee = await prisma.employee.findUnique({
            where: { id: cs.client.assignedEmployeeId },
            select: { userId: true },
          })
          if (employee?.userId) {
            await prisma.notification.create({
              data: {
                userId: employee.userId,
                title: "New Compliance Task",
                message: `${tmpl.title} for ${cs.client.name} — due ${format(dueDate, "dd MMM yyyy")}`,
                type: "COMPLIANCE_DUE",
                entityType: "COMPLIANCE",
                entityId: event.id,
              },
            })
          }
        }

        created++
      } catch (err) {
        errors.push(`${cs.client.name}/${tmpl.title}: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    }
  }

  return { created, errors }
}

function computeDueDate(
  frequency: string,
  dueDayOfMonth: number,
  targetMonth: Date
): Date | null {
  const year = targetMonth.getFullYear()
  const month = targetMonth.getMonth()

  switch (frequency) {
    case "MONTHLY": {
      const lastDay = new Date(year, month + 1, 0).getDate()
      const day = Math.min(dueDayOfMonth, lastDay)
      return new Date(year, month, day)
    }
    case "QUARTERLY": {
      if (month % 3 !== 0) return null
      const lastDay = new Date(year, month + 1, 0).getDate()
      const day = Math.min(dueDayOfMonth, lastDay)
      return new Date(year, month, day)
    }
    case "ANNUAL": {
      if (month !== 2) return null // March (FY end month)
      const lastDay = new Date(year, month + 1, 0).getDate()
      const day = Math.min(dueDayOfMonth, lastDay)
      return new Date(year, month, day)
    }
    default:
      return null
  }
}
