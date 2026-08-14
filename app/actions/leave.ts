"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { toUserError } from "@/lib/forms/errors"
import {
  assessCapacity,
  isOnLeave,
  peakWindows,
  type CapacityAssessment,
} from "@/lib/workforce/capacity"

/**
 * Leave, and what it does to the work.
 *
 * Assignment had no idea anyone was away. A task routed to whoever owned the
 * client sat in their queue looking assigned and worked-on while they were on
 * leave for the fortnight covering its deadline — and the first sign was the
 * deadline passing.
 */

const leaveSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().min(1, "When does the leave start?"),
  endDate: z.string().min(1, "When does it end?"),
  type: z.enum(["ANNUAL", "SICK", "UNPAID", "SABBATICAL", "OTHER"]).default("ANNUAL"),
  notes: z.string().trim().optional(),
})

export type LeaveRow = {
  id: string
  employeeId: string
  employeeName: string
  startDate: string
  endDate: string
  type: string
  status: string
  notes: string | null
}

export async function getLeave(opts?: {
  from?: string
  to?: string
}): Promise<LeaveRow[]> {
  await requireAuth()

  const from = opts?.from ? new Date(opts.from) : new Date()
  const to = opts?.to ? new Date(opts.to) : new Date(from.getFullYear(), from.getMonth() + 6, 0)

  const rows = await prisma.employeeLeave.findMany({
    // Any overlap with the window, not just leave that starts inside it — a
    // three-week absence beginning last Friday is exactly what a manager
    // looking at this week needs to see.
    where: {
      status: { in: ["REQUESTED", "APPROVED"] },
      startDate: { lte: to },
      endDate: { gte: from },
    },
    include: { employee: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  })

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    type: r.type,
    status: r.status,
    notes: r.notes,
  }))
}

export async function saveLeave(
  input: unknown,
  leaveId?: string
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to record leave." }
  }

  const parsed = leaveSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { success: false, error: "Those dates are not valid." }
  }
  if (endDate < startDate) {
    return {
      success: false,
      fieldErrors: { endDate: ["Leave cannot end before it starts."] },
    }
  }

  try {
    const payload = {
      employeeId: data.employeeId,
      startDate,
      endDate,
      type: data.type,
      notes: data.notes?.trim() || null,
      approvedBy: session.user.id,
    }

    if (leaveId) {
      const updated = await prisma.employeeLeave.updateMany({
        where: { id: leaveId },
        data: payload,
      })
      if (updated.count === 0) return { success: false, error: "That leave record no longer exists." }
    } else {
      await prisma.employeeLeave.create({ data: { ...payload, status: "APPROVED" } })
    }

    revalidatePath("/workforce")
    return { success: true }
  } catch (error) {
    console.error("Failed to save leave:", error)
    return { success: false, error: toUserError(error) }
  }
}

export async function cancelLeave(leaveId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to change leave." }
  }
  const updated = await prisma.employeeLeave.updateMany({
    where: { id: leaveId },
    data: { status: "CANCELLED" },
  })
  if (updated.count === 0) return { success: false, error: "That leave record no longer exists." }
  revalidatePath("/workforce")
  return { success: true }
}

/**
 * Is this person away when this task is due?
 *
 * Called before an assignment is committed, so the answer arrives while the
 * choice is still open. It warns and never blocks: covering someone's leave by
 * assigning ahead is a normal thing to do, and a hard stop would only be
 * worked around by assigning to nobody.
 */
export async function checkAssigneeAvailability(input: {
  employeeId: string
  dueDate?: string | null
}): Promise<{ onLeave: boolean; message: string | null }> {
  await requireAuth()
  if (!input.employeeId || !input.dueDate) return { onLeave: false, message: null }

  const due = new Date(input.dueDate)
  if (Number.isNaN(due.getTime())) return { onLeave: false, message: null }

  const [employee, leave] = await Promise.all([
    prisma.employee.findUnique({ where: { id: input.employeeId }, select: { name: true } }),
    prisma.employeeLeave.findMany({
      where: {
        employeeId: input.employeeId,
        status: { in: ["REQUESTED", "APPROVED"] },
        startDate: { lte: due },
        endDate: { gte: due },
      },
      select: { startDate: true, endDate: true },
    }),
  ])

  if (!isOnLeave(due, leave)) return { onLeave: false, message: null }

  const period = leave[0]
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })

  return {
    onLeave: true,
    message: `${employee?.name ?? "That person"} is on leave from ${fmt(period.startDate)} to ${fmt(period.endDate)}, which covers this due date.`,
  }
}

export type CapacityReport = {
  windowLabel: string
  from: string
  to: string
  rows: CapacityAssessment[]
}

/**
 * Who is over-committed, for a window.
 *
 * Defaults to the next 30 days; `peak` swaps in September or March, which are
 * the two months an Indian practice actually plans around.
 */
export async function getCapacity(opts?: {
  from?: string
  to?: string
  peak?: "september" | "march"
}): Promise<CapacityReport> {
  await requirePartnerOrManager()

  const now = new Date()
  let from = new Date(now)
  let to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)
  let windowLabel = "Next 30 days"

  if (opts?.peak) {
    // Peaks are named by the financial year they belong to: September of the
    // current FY, then the March that closes it.
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
    const windows = peakWindows(fyStart)
    const chosen = opts.peak === "september" ? windows[0] : windows[1]
    from = chosen.from
    to = chosen.to
    windowLabel = chosen.label
  } else if (opts?.from && opts?.to) {
    from = new Date(opts.from)
    to = new Date(opts.to)
    windowLabel = "Selected period"
  }

  const [employees, dueCounts, overdueCounts, leave] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.groupBy({
      by: ["assignedEmployeeId"],
      where: {
        status: { not: "FILED_DONE" },
        dueDate: { gte: from, lte: to },
      },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["assignedEmployeeId"],
      where: { status: { not: "FILED_DONE" }, dueDate: { lt: now } },
      _count: { _all: true },
    }),
    prisma.employeeLeave.findMany({
      where: {
        status: { in: ["REQUESTED", "APPROVED"] },
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    }),
  ])

  const dueBy = new Map(dueCounts.map((d) => [d.assignedEmployeeId, d._count._all]))
  const overdueBy = new Map(overdueCounts.map((d) => [d.assignedEmployeeId, d._count._all]))
  const leaveBy = new Map<string, Array<{ startDate: Date; endDate: Date }>>()
  for (const l of leave) {
    const list = leaveBy.get(l.employeeId) ?? []
    list.push({ startDate: l.startDate, endDate: l.endDate })
    leaveBy.set(l.employeeId, list)
  }

  const rows = employees
    .map((e) =>
      assessCapacity({
        employeeId: e.id,
        employeeName: e.name,
        dueInWindow: dueBy.get(e.id) ?? 0,
        overdue: overdueBy.get(e.id) ?? 0,
        windowFrom: from,
        windowTo: to,
        leave: leaveBy.get(e.id) ?? [],
      })
    )
    // Worst first — a capacity report nobody has to sort is one people read.
    .sort((a, b) => {
      const order = { OVER: 0, TIGHT: 1, BUSY: 2, CLEAR: 3 } as const
      return order[a.load] - order[b.load] || b.tasksPerDay - a.tasksPerDay
    })

  return {
    windowLabel,
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
  }
}
