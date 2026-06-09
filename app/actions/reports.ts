"use server"

import { z } from "zod"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"

// ─────────────────────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────────────────────

const reportFiltersSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  employeeId: z.string().optional(),
  clientId: z.string().optional(),
  department: z.string().optional(),
})

export type ReportFilters = z.infer<typeof reportFiltersSchema>

function toDateRange(filters: ReportFilters): { start?: Date; end?: Date } {
  const start = filters.startDate ? new Date(filters.startDate) : undefined
  const end = filters.endDate ? new Date(filters.endDate) : undefined
  return { start, end }
}

function isDefined<T>(v: T | undefined | null): v is T {
  return v !== undefined && v !== null
}

// ─────────────────────────────────────────────────────────────────────────────
// Compliance report
// ─────────────────────────────────────────────────────────────────────────────

export async function getComplianceReport(filters: ReportFilters) {
  const session = await requirePartnerOrManager()
  const parsed = reportFiltersSchema.safeParse(filters)
  if (!parsed.success) throw new Error("Invalid filters")

  const now = new Date()
  const { start, end } = toDateRange(parsed.data)

  const dueDateFilter =
    start || end
      ? {
          dueDate: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}

  const clientFilter = parsed.data.clientId
    ? { clientId: parsed.data.clientId }
    : {}

  // Filter by employee/department via client assignment
  const employeeClientWhere =
    parsed.data.employeeId || parsed.data.department
      ? {
          client: {
            ...(parsed.data.employeeId
              ? { assignedEmployeeId: parsed.data.employeeId }
              : {}),
            ...(parsed.data.department
              ? { assignedEmployee: { department: parsed.data.department } }
              : {}),
          },
        }
      : {}

  const baseWhere: any = {
    ...clientFilter,
    ...employeeClientWhere,
    ...dueDateFilter,
  }

  const [upcoming, overdueCount, completedCount, totalCount, overdue] =
    await Promise.all([
      prisma.complianceEvent.findMany({
        where: {
          ...baseWhere,
          dueDate: {
            gte: now,
            ...(end ? { lte: end } : {}),
          },
          status: { not: "COMPLETED" },
        },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
        take: 25,
      }),
      prisma.complianceEvent.count({
        where: {
          ...baseWhere,
          OR: [
            { status: "OVERDUE" },
            { dueDate: { lt: now }, status: { not: "COMPLETED" } },
          ],
        },
      }),
      prisma.complianceEvent.count({
        where: {
          ...baseWhere,
          status: "COMPLETED",
        },
      }),
      prisma.complianceEvent.count({
        where: baseWhere,
      }),
      prisma.complianceEvent.findMany({
        where: {
          ...baseWhere,
          OR: [
            { status: "OVERDUE" },
            { dueDate: { lt: now }, status: { not: "COMPLETED" } },
          ],
        },
        include: { client: { select: { id: true, name: true } } },
        orderBy: { dueDate: "asc" },
        take: 25,
      }),
    ])

  const completionRate =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return {
    meta: { generatedAt: new Date().toISOString(), user: session.user },
    stats: {
      total: totalCount,
      upcoming: upcoming.length,
      overdue: overdueCount,
      completed: completedCount,
      completionRate,
    },
    upcoming,
    overdue,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment report
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaymentReport(filters: ReportFilters) {
  const session = await requirePartnerOrManager()
  const parsed = reportFiltersSchema.safeParse(filters)
  if (!parsed.success) throw new Error("Invalid filters")

  const { start, end } = toDateRange(parsed.data)

  const invoiceDateFilter =
    start || end
      ? {
          issueDate: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}

  const invoiceWhere: any = {
    ...invoiceDateFilter,
    ...(parsed.data.clientId ? { clientId: parsed.data.clientId } : {}),
    ...(parsed.data.employeeId || parsed.data.department
      ? {
          client: {
            ...(parsed.data.employeeId
              ? { assignedEmployeeId: parsed.data.employeeId }
              : {}),
            ...(parsed.data.department
              ? { assignedEmployee: { department: parsed.data.department } }
              : {}),
          },
        }
      : {}),
  }

  const [outstandingInvoices, paidInvoices, totals] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...invoiceWhere,
        outstandingAmount: { gt: 0 },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }, { issueDate: "desc" }],
      take: 50,
    }),
    prisma.invoice.findMany({
      where: {
        ...invoiceWhere,
        paidAmount: { gt: 0 },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ issueDate: "desc" }],
      take: 50,
    }),
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: {
        amount: true,
        paidAmount: true,
        outstandingAmount: true,
      },
      _count: true,
    }),
  ])

  // Serialize Decimal objects to numbers for client components
  const serializedOutstandingInvoices = outstandingInvoices.map(invoice => ({
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
  }))

  const serializedPaidInvoices = paidInvoices.map(invoice => ({
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
  }))

  const totalAmount = Number(totals._sum.amount ?? 0)
  const totalCollected = Number(totals._sum.paidAmount ?? 0)
  const totalOutstanding = Number(totals._sum.outstandingAmount ?? 0)
  const collectionRate =
    totalAmount > 0 ? Math.round((totalCollected / totalAmount) * 100) : 0

  return {
    meta: { generatedAt: new Date().toISOString(), user: session.user },
    stats: {
      totalInvoiced: totalAmount,
      totalCollected,
      totalOutstanding,
      invoiceCount: totals._count,
      collectionRate,
    },
    outstandingInvoices: serializedOutstandingInvoices,
    paidInvoices: serializedPaidInvoices,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee report
// ─────────────────────────────────────────────────────────────────────────────

export async function getEmployeeReport(filters: ReportFilters) {
  const session = await requirePartnerOrManager()
  const parsed = reportFiltersSchema.safeParse(filters)
  if (!parsed.success) throw new Error("Invalid filters")

  const now = new Date()
  const { start, end } = toDateRange(parsed.data)

  const taskDateFilter =
    start || end
      ? {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}

  const employeeWhere: any = {
    ...(parsed.data.employeeId ? { id: parsed.data.employeeId } : {}),
    ...(parsed.data.department ? { department: parsed.data.department } : {}),
    isActive: true,
  }

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, name: true, email: true, department: true },
    orderBy: [{ department: "asc" }, { name: "asc" }],
  })

  const employeeIds = employees.map((e) => e.id)

  const [completedByEmployee, overdueByEmployee, totalAssignedByEmployee] =
    await Promise.all([
      prisma.task.groupBy({
        by: ["assignedEmployeeId"],
        where: {
          ...taskDateFilter,
          assignedEmployeeId: { in: employeeIds },
          status: "FILED_DONE",
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["assignedEmployeeId"],
        where: {
          ...taskDateFilter,
          assignedEmployeeId: { in: employeeIds },
          dueDate: { lt: now },
          status: { not: "FILED_DONE" },
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["assignedEmployeeId"],
        where: {
          ...taskDateFilter,
          assignedEmployeeId: { in: employeeIds },
        },
        _count: { _all: true },
      }),
    ])

  const index = (
    rows: Array<{ assignedEmployeeId: string | null; _count: { _all: number } }>
  ) =>
    new Map(
      rows
        .filter((r) => isDefined(r.assignedEmployeeId))
        .map((r) => [r.assignedEmployeeId as string, r._count._all])
    )

  const completedMap = index(completedByEmployee as any)
  const overdueMap = index(overdueByEmployee as any)
  const totalMap = index(totalAssignedByEmployee as any)

  const rows = employees.map((e) => {
    const completed = completedMap.get(e.id) ?? 0
    const overdue = overdueMap.get(e.id) ?? 0
    const assigned = totalMap.get(e.id) ?? 0
    const productivity =
      assigned > 0 ? Math.round((completed / assigned) * 100) : 0
    return { ...e, assigned, completed, overdue, productivity }
  })

  return {
    meta: { generatedAt: new Date().toISOString(), user: session.user },
    employees: rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client report
// ─────────────────────────────────────────────────────────────────────────────

export async function getClientReport(filters: ReportFilters) {
  const session = await requirePartnerOrManager()
  const parsed = reportFiltersSchema.safeParse(filters)
  if (!parsed.success) throw new Error("Invalid filters")

  const now = new Date()
  const { start, end } = toDateRange(parsed.data)

  const dueDateFilter =
    start || end
      ? {
          dueDate: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}

  const clients = await prisma.client.findMany({
    where: {
      ...(parsed.data.clientId ? { id: parsed.data.clientId } : {}),
      ...(parsed.data.employeeId ? { assignedEmployeeId: parsed.data.employeeId } : {}),
      ...(parsed.data.department
        ? { assignedEmployee: { department: parsed.data.department } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      clientCode: true,
      assignedEmployeeName: true,
      assignedEmployeeId: true,
    },
    orderBy: { name: "asc" },
    take: parsed.data.clientId ? 1 : 200,
  })

  const clientIds = clients.map((c) => c.id)

  const [complianceTotals, complianceOverdue, complianceCompleted] =
    await Promise.all([
      prisma.complianceEvent.groupBy({
        by: ["clientId"],
        where: {
          ...dueDateFilter,
          clientId: { in: clientIds },
        },
        _count: { _all: true },
      }),
      prisma.complianceEvent.groupBy({
        by: ["clientId"],
        where: {
          ...dueDateFilter,
          clientId: { in: clientIds },
          OR: [
            { status: "OVERDUE" },
            { dueDate: { lt: now }, status: { not: "COMPLETED" } },
          ],
        },
        _count: { _all: true },
      }),
      prisma.complianceEvent.groupBy({
        by: ["clientId"],
        where: {
          ...dueDateFilter,
          clientId: { in: clientIds },
          status: "COMPLETED",
        },
        _count: { _all: true },
      }),
    ])

  const toCountMap = (
    rows: Array<{ clientId: string | null; _count: { _all: number } }>
  ) =>
    new Map(
      rows
        .filter((r) => isDefined(r.clientId))
        .map((r) => [r.clientId as string, r._count._all])
    )

  const totalMap = toCountMap(complianceTotals as any)
  const overdueMap = toCountMap(complianceOverdue as any)
  const completedMap = toCountMap(complianceCompleted as any)

  // Payments / tasks: use aggregates per client
  const [invoiceAgg, openTasksAgg] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["clientId"],
      where: { clientId: { in: clientIds } },
      _sum: { outstandingAmount: true },
    }),
    prisma.task.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: clientIds },
        status: { not: "FILED_DONE" },
      },
      _count: { _all: true },
    }),
  ])

  const outstandingMap = new Map(
    invoiceAgg
      .filter((r) => isDefined(r.clientId))
      .map((r) => [r.clientId as string, Number(r._sum.outstandingAmount ?? 0)])
  )
  const openTasksMap = new Map(
    openTasksAgg
      .filter((r) => isDefined(r.clientId))
      .map((r) => [r.clientId as string, r._count._all])
  )

  const rows = clients.map((c) => {
    const total = totalMap.get(c.id) ?? 0
    const overdue = overdueMap.get(c.id) ?? 0
    const completed = completedMap.get(c.id) ?? 0
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const complianceScore = Math.max(
      0,
      Math.min(100, completionRate - Math.round((overdue / Math.max(total, 1)) * 50))
    )

    return {
      ...c,
      complianceScore,
      outstandingPayments: outstandingMap.get(c.id) ?? 0,
      openTasks: openTasksMap.get(c.id) ?? 0,
    }
  })

  return {
    meta: { generatedAt: new Date().toISOString(), user: session.user },
    clients: rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined dashboard payload (single round-trip for UI)
// ─────────────────────────────────────────────────────────────────────────────

export async function getReportingCenterData(filters: ReportFilters) {
  await requireAuth()
  const parsed = reportFiltersSchema.safeParse(filters)
  if (!parsed.success) throw new Error("Invalid filters")

  const [compliance, payments, employees, clients] = await Promise.all([
    getComplianceReport(parsed.data),
    getPaymentReport(parsed.data),
    getEmployeeReport(parsed.data),
    getClientReport(parsed.data),
  ])

  return { compliance, payments, employees, clients }
}

export async function getReportFilterOptions() {
  await requirePartnerOrManager()

  const [employees, clients] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, department: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ])

  const departments = Array.from(
    new Set(employees.map((e) => e.department).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b))

  return { employees, clients, departments }
}
