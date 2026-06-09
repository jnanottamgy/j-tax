"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { addMonths, addYears, addDays, format } from "date-fns"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity/logger"

export type ComplianceActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

// ─── Validation ──────────────────────────────────────────────────────────────

const COMPLIANCE_TYPES = ["GSTR_1", "GSTR_3B", "TDS", "ROC", "ITR", "PF_ESIC", "AUDIT", "CUSTOM"] as const
const WORKFLOW_STATUSES = ["NOT_STARTED", "DOCUMENTS_AWAITED", "IN_PROGRESS", "UNDER_REVIEW", "FILED", "COMPLETED", "OVERDUE"] as const

const complianceEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(COMPLIANCE_TYPES),
  dueDate: z.string().min(1, "Due date is required"),
  clientId: z.string().optional(),
  isStatutory: z.boolean().default(true),
  reminderDays: z.coerce.number().int().min(0).max(90).default(7),
  taskId: z.string().optional(),
  filingPeriod: z.string().optional(),
  notes: z.string().optional(),
  workflowStatus: z.enum(WORKFLOW_STATUSES).default("NOT_STARTED"),
})

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getComplianceDashboard() {
  const session = await requireAuth()
  const now = new Date()
  const thirtyDaysOut = addDays(now, 30)

  const isExecutive = session.user.role === "EXECUTIVE"
  const assignedEmployee = isExecutive
    ? await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null
  const clientFilter =
    isExecutive && assignedEmployee
      ? { assignedEmployeeId: assignedEmployee.id }
      : {}

  const [
    totalEvents,
    completedEvents,
    overdueEvents,
    upcomingEvents,
    byType,
    recentlyCompleted,
    clientsWithCompliance,
  ] = await Promise.all([
    prisma.complianceEvent.count({
      where: { client: Object.keys(clientFilter).length ? clientFilter : undefined },
    }),
    prisma.complianceEvent.count({
      where: {
        client: Object.keys(clientFilter).length ? clientFilter : undefined,
        status: "COMPLETED",
      },
    }),
    prisma.complianceEvent.count({
      where: {
        client: Object.keys(clientFilter).length ? clientFilter : undefined,
        OR: [
          { status: "OVERDUE" },
          { dueDate: { lt: now }, status: { not: "COMPLETED" } },
        ],
      },
    }),
    prisma.complianceEvent.findMany({
      where: {
        client: Object.keys(clientFilter).length ? clientFilter : undefined,
        dueDate: { gte: now, lte: thirtyDaysOut },
        status: { not: "COMPLETED" },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.complianceEvent.groupBy({
      by: ["type"],
      where: { client: Object.keys(clientFilter).length ? clientFilter : undefined },
      _count: true,
    }),
    prisma.complianceEvent.findMany({
      where: {
        client: Object.keys(clientFilter).length ? clientFilter : undefined,
        status: "COMPLETED",
        completedAt: { gte: addDays(now, -30) },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
    prisma.client.count({
      where: {
        ...clientFilter,
        complianceEvents: { some: {} },
      },
    }),
  ])

  const completionRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0
  const healthScore = Math.max(
    0,
    Math.min(100, completionRate - Math.round((overdueEvents / Math.max(totalEvents, 1)) * 50))
  )

  return {
    stats: {
      total: totalEvents,
      completed: completedEvents,
      overdue: overdueEvents,
      upcoming: upcomingEvents.length,
      completionRate,
      healthScore,
      clientsWithCompliance,
    },
    upcomingEvents,
    recentlyCompleted,
    byType,
    user: session.user,
  }
}

export async function getComplianceEvents(month?: number, year?: number) {
  const session = await requireAuth()

  const isExecutive = session.user.role === "EXECUTIVE"
  const assignedEmployee = isExecutive
    ? await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null
  const clientFilter =
    isExecutive && assignedEmployee
      ? { assignedEmployeeId: assignedEmployee.id }
      : {}

  const where: any = {}
  if (Object.keys(clientFilter).length) {
    where.client = clientFilter
  }

  if (month !== undefined && year !== undefined) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)
    where.dueDate = { gte: startDate, lte: endDate }
  }

  const events = await prisma.complianceEvent.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
    },
    orderBy: [{ dueDate: "asc" }, { type: "asc" }],
  })

  return { events, user: session.user }
}

export async function getUpcomingDeadlines(days: number = 30) {
  const session = await requireAuth()
  const startDate = new Date()
  const endDate = addDays(startDate, days)

  const isExecutive = session.user.role === "EXECUTIVE"
  const assignedEmployee = isExecutive
    ? await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null
  const clientFilter =
    isExecutive && assignedEmployee
      ? { assignedEmployeeId: assignedEmployee.id }
      : {}

  const events = await prisma.complianceEvent.findMany({
    where: {
      client: Object.keys(clientFilter).length ? clientFilter : undefined,
      dueDate: { gte: startDate, lte: endDate },
      status: { not: "COMPLETED" },
    },
    include: {
      client: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
    },
    orderBy: [{ dueDate: "asc" }, { type: "asc" }],
  })

  return { events, user: session.user }
}

export async function getClientComplianceData(clientId: string) {
  const session = await requireAuth()

  // EXECUTIVE permission check
  if (session.user.role === "EXECUTIVE") {
    const assignedEmployee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client || !assignedEmployee || client.assignedEmployeeId !== assignedEmployee.id) {
      throw new Error("You do not have permission to view this client's compliance data")
    }
  }

  const now = new Date()
  const [allEvents, overdueEvents, completedEvents, upcomingEvents] = await Promise.all([
    prisma.complianceEvent.findMany({
      where: { clientId },
      include: { task: { select: { id: true, title: true, status: true } } },
      orderBy: { dueDate: "desc" },
    }),
    prisma.complianceEvent.count({
      where: {
        clientId,
        OR: [
          { status: "OVERDUE" },
          { dueDate: { lt: now }, status: { not: "COMPLETED" } },
        ],
      },
    }),
    prisma.complianceEvent.count({ where: { clientId, status: "COMPLETED" } }),
    prisma.complianceEvent.findMany({
      where: { clientId, dueDate: { gte: now }, status: { not: "COMPLETED" } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ])

  const total = allEvents.length
  const completionRate = total > 0 ? Math.round((completedEvents / total) * 100) : 100
  const healthScore = Math.max(
    0,
    Math.min(100, completionRate - Math.round((overdueEvents / Math.max(total, 1)) * 50))
  )

  return {
    events: allEvents,
    upcomingEvents,
    stats: { total, completed: completedEvents, overdue: overdueEvents, completionRate, healthScore },
    user: session.user,
  }
}

export async function getComplianceEventDetail(eventId: string) {
  const session = await requireAuth()

  const event = await prisma.complianceEvent.findUnique({
    where: { id: eventId },
    include: {
      client: true,
      task: true,
    },
  })

  if (!event) throw new Error("Compliance event not found")

  if (session.user.role === "EXECUTIVE" && event.clientId) {
    const assignedEmployee = await prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const client = await prisma.client.findUnique({ where: { id: event.clientId } })
    if (!client || !assignedEmployee || client.assignedEmployeeId !== assignedEmployee.id) {
      throw new Error("You do not have permission to view this event")
    }
  }

  return { event, user: session.user }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createComplianceEvent(
  _prevState: ComplianceActionState,
  formData: FormData
): Promise<ComplianceActionState> {
  try {
    const session = await requirePartnerOrManager()

    const raw = {
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      type: formData.get("type") || "CUSTOM",
      dueDate: formData.get("dueDate"),
      clientId: formData.get("clientId") || undefined,
      isStatutory: formData.get("isStatutory") === "true",
      reminderDays: formData.get("reminderDays") || 7,
      taskId: formData.get("taskId") || undefined,
      filingPeriod: formData.get("filingPeriod") || undefined,
      notes: formData.get("notes") || undefined,
      workflowStatus: formData.get("workflowStatus") || "NOT_STARTED",
    }

    const parsed = complianceEventSchema.safeParse(raw)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const event = await prisma.complianceEvent.create({
      data: {
        ...parsed.data,
        dueDate: new Date(parsed.data.dueDate),
      },
    })

    await logActivity({
      entityType: "COMPLIANCE",
      entityId: event.id,
      action: "CREATED",
      description: `Compliance event "${event.title}" was created`,
      userId: session.user.id,
      userName: session.user.name,
    })

    revalidatePath("/calendar")
    revalidatePath("/compliance")
    if (parsed.data.clientId) revalidatePath(`/clients/${parsed.data.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) return { fieldErrors: error.flatten().fieldErrors }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) return { error: "You do not have permission to create compliance events." }
      return { error: error.message }
    }
    return { error: "Failed to create compliance event. Please try again." }
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateComplianceEvent(
  _prevState: ComplianceActionState,
  formData: FormData
): Promise<ComplianceActionState> {
  try {
    const session = await requirePartnerOrManager()

    const id = formData.get("id")
    if (typeof id !== "string" || !id) return { error: "Missing compliance event id" }

    const raw = {
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      type: formData.get("type"),
      dueDate: formData.get("dueDate"),
      clientId: formData.get("clientId") || undefined,
      isStatutory: formData.get("isStatutory") === "true",
      reminderDays: formData.get("reminderDays"),
      taskId: formData.get("taskId") || undefined,
      filingPeriod: formData.get("filingPeriod") || undefined,
      notes: formData.get("notes") || undefined,
      workflowStatus: formData.get("workflowStatus") || "NOT_STARTED",
    }

    const parsed = complianceEventSchema.safeParse(raw)
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    const event = await prisma.complianceEvent.update({
      where: { id },
      data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate) },
    })

    await logActivity({
      entityType: "COMPLIANCE",
      entityId: id,
      action: "UPDATED",
      description: `Compliance event "${event.title}" was updated`,
      userId: session.user.id,
      userName: session.user.name,
    })

    revalidatePath("/calendar")
    revalidatePath("/compliance")
    if (event.clientId) revalidatePath(`/clients/${event.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) return { fieldErrors: error.flatten().fieldErrors }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) return { error: "You do not have permission to edit compliance events." }
      return { error: error.message }
    }
    return { error: "Failed to update compliance event. Please try again." }
  }
}

export async function updateComplianceWorkflowStatus(
  eventId: string,
  workflowStatus: typeof WORKFLOW_STATUSES[number]
): Promise<ComplianceActionState> {
  try {
    const session = await requireAuth()
    if (session.user.role === "EXECUTIVE") {
      return { error: "You do not have permission to update compliance status." }
    }

    const updateData: any = { workflowStatus }

    // Sync the outer status field
    if (workflowStatus === "COMPLETED" || workflowStatus === "FILED") {
      updateData.status = "COMPLETED"
      updateData.completedAt = new Date()
    } else if (workflowStatus === "OVERDUE") {
      updateData.status = "OVERDUE"
    } else {
      updateData.status = "PENDING"
    }

    const event = await prisma.complianceEvent.update({
      where: { id: eventId },
      data: updateData,
    })

    await logActivity({
      entityType: "COMPLIANCE",
      entityId: eventId,
      action: "STATUS_CHANGED",
      description: `Compliance event "${event.title}" status changed to ${workflowStatus}`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { workflowStatus },
    })

    revalidatePath("/calendar")
    revalidatePath("/compliance")
    if (event.clientId) revalidatePath(`/clients/${event.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: "Failed to update status. Please try again." }
  }
}

// Keep backward-compat alias used by existing calendar client
export async function updateComplianceEventStatus(
  eventId: string,
  status: "PENDING" | "COMPLETED" | "OVERDUE" | "CANCELLED"
): Promise<ComplianceActionState> {
  try {
    const session = await requireAuth()
    if (session.user.role === "EXECUTIVE") {
      return { error: "You do not have permission to update compliance event status." }
    }

    const updateData: any = { status }
    if (status === "COMPLETED") {
      updateData.completedAt = new Date()
      updateData.workflowStatus = "COMPLETED"
    } else if (status === "OVERDUE") {
      updateData.workflowStatus = "OVERDUE"
    }

    const event = await prisma.complianceEvent.update({
      where: { id: eventId },
      data: updateData,
    })

    await logActivity({
      entityType: "COMPLIANCE",
      entityId: eventId,
      action: "STATUS_CHANGED",
      description: `Compliance event "${event.title}" marked as ${status}`,
      userId: session.user.id,
      userName: session.user.name,
    })

    revalidatePath("/calendar")
    revalidatePath("/compliance")
    if (event.clientId) revalidatePath(`/clients/${event.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: "Failed to update compliance event status. Please try again." }
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteComplianceEvent(eventId: string): Promise<ComplianceActionState> {
  try {
    const session = await requirePartnerOrManager()

    const event = await prisma.complianceEvent.findUnique({ where: { id: eventId } })
    if (!event) return { error: "Compliance event not found." }

    await prisma.complianceEvent.delete({ where: { id: eventId } })

    await logActivity({
      entityType: "COMPLIANCE",
      entityId: eventId,
      action: "DELETED",
      description: `Compliance event "${event.title}" was deleted`,
      userId: session.user.id,
      userName: session.user.name,
    })

    revalidatePath("/calendar")
    revalidatePath("/compliance")
    if (event.clientId) revalidatePath(`/clients/${event.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) return { error: "You do not have permission to delete compliance events." }
      return { error: error.message }
    }
    return { error: "Failed to delete compliance event. Please try again." }
  }
}

// ─── Automation Engine ────────────────────────────────────────────────────────

/**
 * Called automatically when a client is created with services.
 * Generates ComplianceEvent records for the current financial year
 * based on the services assigned to the client.
 */
export async function generateComplianceEventsForClient(
  clientId: string,
  serviceTypes: string[]
): Promise<{ count: number }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  })
  if (!client) return { count: 0 }

  const now = new Date()
  // Indian FY: April to March
  const fyStart = now.getMonth() >= 3
    ? new Date(now.getFullYear(), 3, 1)   // Apr this year
    : new Date(now.getFullYear() - 1, 3, 1) // Apr last year
  const fyEnd = new Date(fyStart.getFullYear() + 1, 2, 31) // Mar 31 next year
  const fyLabel = `FY${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(2)}`

  const events: any[] = []

  for (const serviceType of serviceTypes) {
    switch (serviceType) {
      case "GST_RETURN": {
        // GSTR-1: monthly, due 11th of following month
        for (let m = 0; m < 12; m++) {
          const periodDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + m, 1)
          if (periodDate > fyEnd) break
          const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 11)
          events.push({
            clientId,
            type: "GSTR_1",
            title: `GSTR-1 — ${format(periodDate, "MMM yyyy")}`,
            dueDate,
            filingPeriod: format(periodDate, "MMM yyyy"),
            isStatutory: true,
            reminderDays: 7,
            workflowStatus: dueDate < now ? "OVERDUE" : "NOT_STARTED",
            status: dueDate < now ? "OVERDUE" : "PENDING",
          })
        }
        // GSTR-3B: monthly, due 20th of following month
        for (let m = 0; m < 12; m++) {
          const periodDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + m, 1)
          if (periodDate > fyEnd) break
          const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 20)
          events.push({
            clientId,
            type: "GSTR_3B",
            title: `GSTR-3B — ${format(periodDate, "MMM yyyy")}`,
            dueDate,
            filingPeriod: format(periodDate, "MMM yyyy"),
            isStatutory: true,
            reminderDays: 7,
            workflowStatus: dueDate < now ? "OVERDUE" : "NOT_STARTED",
            status: dueDate < now ? "OVERDUE" : "PENDING",
          })
        }
        break
      }
      case "TDS": {
        // TDS quarterly returns: Q1 Jul 31, Q2 Oct 31, Q3 Jan 31, Q4 May 31
        const tdsQuarters = [
          { label: `Q1 ${fyLabel}`, dueDate: new Date(fyStart.getFullYear(), 6, 31) },
          { label: `Q2 ${fyLabel}`, dueDate: new Date(fyStart.getFullYear(), 9, 31) },
          { label: `Q3 ${fyLabel}`, dueDate: new Date(fyStart.getFullYear() + 1, 0, 31) },
          { label: `Q4 ${fyLabel}`, dueDate: new Date(fyStart.getFullYear() + 1, 4, 31) },
        ]
        for (const q of tdsQuarters) {
          events.push({
            clientId,
            type: "TDS",
            title: `TDS Return — ${q.label}`,
            dueDate: q.dueDate,
            filingPeriod: q.label,
            isStatutory: true,
            reminderDays: 7,
            workflowStatus: q.dueDate < now ? "OVERDUE" : "NOT_STARTED",
            status: q.dueDate < now ? "OVERDUE" : "PENDING",
          })
        }
        break
      }
      case "INCOME_TAX": {
        // ITR: July 31 for non-audit, Sep 30 for audit
        events.push({
          clientId,
          type: "ITR",
          title: `Income Tax Return — ${fyLabel}`,
          dueDate: new Date(fyStart.getFullYear() + 1, 6, 31),
          filingPeriod: fyLabel,
          isStatutory: true,
          reminderDays: 30,
          workflowStatus: "NOT_STARTED",
          status: "PENDING",
        })
        break
      }
      case "COMPANY_LAW": {
        // ROC Annual Return: Sep 30
        events.push({
          clientId,
          type: "ROC",
          title: `ROC Annual Return — ${fyLabel}`,
          dueDate: new Date(fyStart.getFullYear() + 1, 8, 30),
          filingPeriod: fyLabel,
          isStatutory: true,
          reminderDays: 30,
          workflowStatus: "NOT_STARTED",
          status: "PENDING",
        })
        // ROC Financial Statements: Oct 31
        events.push({
          clientId,
          type: "ROC",
          title: `ROC Financial Statements — ${fyLabel}`,
          dueDate: new Date(fyStart.getFullYear() + 1, 9, 31),
          filingPeriod: fyLabel,
          isStatutory: true,
          reminderDays: 30,
          workflowStatus: "NOT_STARTED",
          status: "PENDING",
        })
        break
      }
      case "PAYROLL": {
        // PF/ESIC: monthly, due 15th of following month
        for (let m = 0; m < 12; m++) {
          const periodDate = new Date(fyStart.getFullYear(), fyStart.getMonth() + m, 1)
          if (periodDate > fyEnd) break
          const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 15)
          events.push({
            clientId,
            type: "PF_ESIC",
            title: `PF/ESIC — ${format(periodDate, "MMM yyyy")}`,
            dueDate,
            filingPeriod: format(periodDate, "MMM yyyy"),
            isStatutory: true,
            reminderDays: 5,
            workflowStatus: dueDate < now ? "OVERDUE" : "NOT_STARTED",
            status: dueDate < now ? "OVERDUE" : "PENDING",
          })
        }
        break
      }
      case "AUDIT": {
        events.push({
          clientId,
          type: "AUDIT",
          title: `Statutory Audit — ${fyLabel}`,
          dueDate: new Date(fyStart.getFullYear() + 1, 8, 30),
          filingPeriod: fyLabel,
          isStatutory: true,
          reminderDays: 30,
          workflowStatus: "NOT_STARTED",
          status: "PENDING",
        })
        break
      }
    }
  }

  if (events.length === 0) return { count: 0 }

  await prisma.complianceEvent.createMany({
    data: events,
    skipDuplicates: true,
  })

  return { count: events.length }
}

// Legacy alias used by old code
export async function generateStatutoryComplianceEvents(clientId: string) {
  try {
    await requirePartnerOrManager()

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { services: true },
    })
    if (!client) return { error: "Client not found" }

    const serviceTypes = client.services.map((s) => s.serviceType)
    const result = await generateComplianceEventsForClient(clientId, serviceTypes)

    revalidatePath("/calendar")
    revalidatePath("/compliance")
    revalidatePath(`/clients/${clientId}`)

    return { success: true, count: result.count }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    return { error: "Failed to generate compliance events." }
  }
}
