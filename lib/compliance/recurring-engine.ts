import { prisma } from "@/lib/prisma"
import { addDays, addMonths, startOfMonth, format } from "date-fns"

import { statutoryEventsInWindow } from "@/lib/compliance/statutory-calendar"
import { resolveGstScheme, type GstScheme } from "@/lib/compliance/gst-scheme"

/**
 * Monthly cron (1st, 03:00) with two halves:
 *
 *  A. STATUTORY filings — enumerated from lib/compliance/statutory-calendar
 *     on a rolling look-ahead window. Same canonical titles as the per-client
 *     generator, so the two engines dedupe against each other instead of
 *     doubling events on the calendar.
 *
 *  B. INTERNAL OPS tasks (document collection, planning reviews) — driven by
 *     RecurringComplianceTemplate rows. These are firm routines, not statutory
 *     filings (complianceType CUSTOM, isStatutory false). GST collection
 *     tasks are labelled with the RETURN period they collect for (the month
 *     before the due month) so "GSTR-1 Data Collection — Jul 2026" (due Aug 5)
 *     pairs with the statutory "GSTR-1 — Jul 2026" (due Aug 11).
 */

type TemplateSeed = {
  serviceType: "BOOKKEEPING" | "GST_RETURN" | "INCOME_TAX" | "TDS" | "AUDIT" | "PAYROLL" | "COMPANY_LAW"
  complianceType: "GSTR_1" | "GSTR_3B" | "TDS" | "ROC" | "ITR" | "PF_ESIC" | "AUDIT" | "CUSTOM"
  title: string
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL"
  dueDayOfMonth: number
  reminderDays: number
  /**
   * Statutory anchor month (1-12) for ANNUAL templates (e.g. audit prep → 9).
   * Not persisted (no dueMonth column) — resolved from this seed list at
   * generation time. ANNUAL templates without one fall back to March.
   */
  dueMonth?: number
  /**
   * Months to shift the period LABEL by (not the due date). -1 for collection
   * tasks that gather last month's data early in the current month.
   */
  periodOffset?: number
}

const DEFAULT_TEMPLATES: TemplateSeed[] = [
  // Bookkeeping — monthly collection of the PREVIOUS month's records
  { serviceType: "BOOKKEEPING", complianceType: "CUSTOM", title: "Collect Bank Statements", frequency: "MONTHLY", dueDayOfMonth: 5, reminderDays: 3, periodOffset: -1 },
  { serviceType: "BOOKKEEPING", complianceType: "CUSTOM", title: "Collect Sales Data", frequency: "MONTHLY", dueDayOfMonth: 7, reminderDays: 3, periodOffset: -1 },
  { serviceType: "BOOKKEEPING", complianceType: "CUSTOM", title: "Collect Purchase Data", frequency: "MONTHLY", dueDayOfMonth: 7, reminderDays: 3, periodOffset: -1 },
  { serviceType: "BOOKKEEPING", complianceType: "CUSTOM", title: "Collect Expense Receipts", frequency: "MONTHLY", dueDayOfMonth: 10, reminderDays: 5, periodOffset: -1 },

  // GST — internal data collection ahead of the statutory filings (11th/20th)
  { serviceType: "GST_RETURN", complianceType: "CUSTOM", title: "GSTR-1 Data Collection", frequency: "MONTHLY", dueDayOfMonth: 5, reminderDays: 3, periodOffset: -1 },
  { serviceType: "GST_RETURN", complianceType: "CUSTOM", title: "GSTR-3B Reconciliation Prep", frequency: "MONTHLY", dueDayOfMonth: 14, reminderDays: 3, periodOffset: -1 },

  // Income tax — annual planning routine (not a filing)
  { serviceType: "INCOME_TAX", complianceType: "CUSTOM", title: "Tax Planning Review", frequency: "ANNUAL", dueDayOfMonth: 1, reminderDays: 30, dueMonth: 3 },

  // Audit — preparation routines ahead of the Sep 30 statutory deadline
  { serviceType: "AUDIT", complianceType: "CUSTOM", title: "Audit Documentation Collection", frequency: "ANNUAL", dueDayOfMonth: 1, reminderDays: 30, dueMonth: 9 },
  { serviceType: "AUDIT", complianceType: "CUSTOM", title: "Financial Statement Preparation", frequency: "ANNUAL", dueDayOfMonth: 15, reminderDays: 14, dueMonth: 9 },
]

// Statutory filings previously modelled as templates — now generated from the
// statutory calendar. Deactivated (not deleted) so historical events keep
// their provenance and the change is reversible.
function isSeedTemplate(t: { serviceType: string; complianceType: string; title: string }): boolean {
  return DEFAULT_TEMPLATES.some(
    (s) => s.serviceType === t.serviceType && s.complianceType === t.complianceType && s.title === t.title
  )
}

function seedFor(t: { serviceType: string; complianceType: string; title: string }): TemplateSeed | undefined {
  return DEFAULT_TEMPLATES.find(
    (s) => s.serviceType === t.serviceType && s.complianceType === t.complianceType && s.title === t.title
  )
}

/** How far ahead the cron materializes statutory events. Runs monthly, so the
 *  window must comfortably exceed one month; 75 days also gives assignees
 *  lead time on 30-day-reminder annual filings. */
const STATUTORY_LOOKAHEAD_DAYS = 75

export async function seedDefaultTemplates() {
  for (const { dueMonth: _m, periodOffset: _o, ...tmpl } of DEFAULT_TEMPLATES) {
    await prisma.recurringComplianceTemplate.upsert({
      where: {
        serviceType_complianceType_title: {
          serviceType: tmpl.serviceType,
          complianceType: tmpl.complianceType,
          title: tmpl.title,
        },
      },
      update: { isActive: true },
      create: tmpl,
    })
  }

  // Retire template rows superseded by the statutory calendar (old
  // "Reconciliation & Filing" / "ITR Filing" / "Annual ROC Filing" seeds).
  const all = await prisma.recurringComplianceTemplate.findMany({
    where: { isActive: true },
  })
  const obsolete = all.filter((t) => !isSeedTemplate(t))
  if (obsolete.length > 0) {
    await prisma.recurringComplianceTemplate.updateMany({
      where: { id: { in: obsolete.map((t) => t.id) } },
      data: { isActive: false },
    })
  }
}

type ClientServices = {
  clientId: string
  clientName: string
  assignedEmployeeId: string | null
  serviceTypes: string[]
  /** Resolved GST cadence — see lib/compliance/gst-scheme.ts. */
  gstScheme: GstScheme
  stateCode: string | null
}

async function createEventWithTask(input: {
  clientId: string
  clientName: string
  assignedEmployeeId: string | null
  type: string
  title: string
  description: string
  dueDate: Date
  filingPeriod: string
  reminderDays: number
  isStatutory: boolean
  serviceType: string
}): Promise<void> {
  const event = await prisma.complianceEvent.create({
    data: {
      clientId: input.clientId,
      type: input.type as any,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      status: "PENDING",
      workflowStatus: "NOT_STARTED",
      isStatutory: input.isStatutory,
      reminderDays: input.reminderDays,
      filingPeriod: input.filingPeriod,
    },
  })

  await prisma.task.create({
    data: {
      clientId: input.clientId,
      title: `${input.title} — ${input.clientName}`,
      description: `Auto-generated compliance task for ${input.filingPeriod}`,
      status: "NOT_STARTED",
      priority: "MEDIUM",
      dueDate: input.dueDate,
      serviceType: input.serviceType as any,
      assignedEmployeeId: input.assignedEmployeeId,
      complianceEvents: { connect: { id: event.id } },
    },
  })

  if (input.assignedEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.assignedEmployeeId },
      select: { userId: true },
    })
    if (employee?.userId) {
      await prisma.notification.create({
        data: {
          userId: employee.userId,
          title: "New Compliance Task",
          message: `${input.title} for ${input.clientName} — due ${format(input.dueDate, "dd MMM yyyy")}`,
          type: "COMPLIANCE_DUE",
          entityType: "COMPLIANCE",
          entityId: event.id,
        },
      })
    }
  }
}

export async function generateRecurringComplianceTasks(): Promise<{ created: number; errors: string[] }> {
  const now = new Date()
  let created = 0
  const errors: string[] = []

  const clientServices = await prisma.clientService.findMany({
    where: { isActive: true, client: { status: "ACTIVE" } },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          assignedEmployeeId: true,
          // The client's own facts decide which returns are actually due —
          // a QRMP filer owes four GSTR-3Bs a year, not twelve.
          annualTurnover: true,
          gstFilingScheme: true,
          stateCode: true,
          gstin: true,
        },
      },
    },
  })

  // Group services per client — the full list matters (an AUDIT engagement
  // shifts the client's ITR due date to Oct 31).
  const byClient = new Map<string, ClientServices>()
  for (const cs of clientServices) {
    const entry = byClient.get(cs.clientId) ?? {
      clientId: cs.clientId,
      clientName: cs.client.name,
      assignedEmployeeId: cs.client.assignedEmployeeId,
      serviceTypes: [],
      gstScheme: resolveGstScheme({
        explicit: cs.client.gstFilingScheme,
        annualTurnover:
          cs.client.annualTurnover != null ? Number(cs.client.annualTurnover) : null,
      }).scheme,
      stateCode: cs.client.stateCode ?? cs.client.gstin?.slice(0, 2) ?? null,
    }
    entry.serviceTypes.push(cs.serviceType)
    byClient.set(cs.clientId, entry)
  }

  // ── A. Statutory filings from the shared calendar ─────────────────────────
  const windowEnd = addDays(now, STATUTORY_LOOKAHEAD_DAYS)

  for (const client of byClient.values()) {
    const specs = statutoryEventsInWindow(client.serviceTypes, now, windowEnd, {
      gstScheme: client.gstScheme,
      stateCode: client.stateCode,
    })
    if (specs.length === 0) continue

    const existing = await prisma.complianceEvent.findMany({
      where: { clientId: client.clientId, title: { in: specs.map((s) => s.title) } },
      select: { title: true },
    })
    const existingTitles = new Set(existing.map((e) => e.title))

    for (const spec of specs) {
      if (existingTitles.has(spec.title)) continue
      try {
        await createEventWithTask({
          clientId: client.clientId,
          clientName: client.clientName,
          assignedEmployeeId: client.assignedEmployeeId,
          type: spec.type,
          title: spec.title,
          description: spec.description,
          dueDate: spec.dueDate,
          filingPeriod: spec.filingPeriod,
          reminderDays: spec.reminderDays,
          isStatutory: true,
          serviceType: spec.serviceType,
        })
        created++
      } catch (err) {
        errors.push(`${client.clientName}/${spec.title}: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    }
  }

  // ── B. Internal ops routines from templates ──────────────────────────────
  const templates = await prisma.recurringComplianceTemplate.findMany({
    where: { isActive: true },
  })

  const targetMonth = addMonths(startOfMonth(now), 1)

  for (const tmpl of templates) {
    const seed = seedFor(tmpl)
    const dueDate = computeOpsDueDate(tmpl.frequency, tmpl.dueDayOfMonth, targetMonth, seed?.dueMonth)
    if (!dueDate) continue

    // Label with the data period, not the due month: collection tasks early
    // in month M gather month M-1's records.
    const periodMonth = addMonths(targetMonth, seed?.periodOffset ?? 0)
    const filingPeriod = format(periodMonth, "MMM yyyy")
    const eventTitle = `${tmpl.title} — ${filingPeriod}`

    const relevant = [...byClient.values()].filter((c) => c.serviceTypes.includes(tmpl.serviceType))

    for (const client of relevant) {
      const existing = await prisma.complianceEvent.findFirst({
        where: { clientId: client.clientId, title: eventTitle },
        select: { id: true },
      })
      if (existing) continue

      try {
        await createEventWithTask({
          clientId: client.clientId,
          clientName: client.clientName,
          assignedEmployeeId: client.assignedEmployeeId,
          type: tmpl.complianceType,
          title: eventTitle,
          description: tmpl.description || `Internal routine for the ${tmpl.serviceType} engagement`,
          dueDate,
          filingPeriod,
          reminderDays: tmpl.reminderDays,
          isStatutory: false,
          serviceType: tmpl.serviceType,
        })
        created++
      } catch (err) {
        errors.push(`${client.clientName}/${eventTitle}: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    }
  }

  return { created, errors }
}

function computeOpsDueDate(
  frequency: string,
  dueDayOfMonth: number,
  targetMonth: Date,
  dueMonth?: number
): Date | null {
  const year = targetMonth.getFullYear()
  const month = targetMonth.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const day = Math.min(dueDayOfMonth, lastDay)

  switch (frequency) {
    case "MONTHLY":
      return new Date(year, month, day)
    case "ANNUAL": {
      // Fire only in the template's anchor month (audit prep → Sep, tax
      // planning → Mar); templates without one fall back to March (FY end).
      const anchorMonth = (dueMonth ?? 3) - 1
      if (month !== anchorMonth) return null
      return new Date(year, month, day)
    }
    default:
      // QUARTERLY ops templates no longer exist — advance tax is statutory now.
      return null
  }
}
