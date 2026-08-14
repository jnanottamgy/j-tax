"use server"

import { revalidatePath } from "next/cache"
import { addDays, format, startOfWeek } from "date-fns"
import { z } from "zod"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { toUserError } from "@/lib/forms/errors"
import { prisma } from "@/lib/prisma"

// ─── Types ────────────────────────────────────────────────────────────────────

export type RunningTimer = {
  id: string
  taskId: string | null
  taskTitle: string | null
  clientId: string | null
  clientName: string | null
  description: string | null
  /** ISO timestamp */
  startedAt: string
}

export type TimesheetEntry = {
  id: string
  taskId: string | null
  taskTitle: string | null
  clientId: string | null
  clientName: string | null
  description: string | null
  /** ISO timestamps */
  startedAt: string
  endedAt: string | null
  minutes: number
  billable: boolean
  /** Live timer entry — minutes reflect elapsed time at fetch */
  running: boolean
}

export type TimesheetDay = {
  /** yyyy-MM-dd */
  date: string
  totalMinutes: number
  entries: TimesheetEntry[]
}

export type MyTimesheet = {
  /** Monday, yyyy-MM-dd */
  weekStart: string
  days: TimesheetDay[]
  weekTotalMinutes: number
  billableMinutes: number
  nonBillableMinutes: number
}

export type TeamTimesheetRow = {
  employeeId: string
  employeeName: string
  department: string | null
  totalMinutes: number
  billableMinutes: number
  entryCount: number
}

export type TaskTimeSummary = {
  taskId: string
  totalMinutes: number
  estimatedMinutes: number | null
  perPerson: { employeeId: string; employeeName: string; minutes: number }[]
  recentEntries: {
    id: string
    employeeName: string
    startedAt: string
    minutes: number
    running: boolean
  }[]
}

export type TimesheetOptions = {
  clients: { id: string; name: string }[]
  tasks: { id: string; title: string; clientId: string; clientName: string }[]
}

export type TimeEntryActionResult =
  | { success: true; minutes?: number }
  | { success: false; error: string }

const NO_EMPLOYEE_PROFILE = "No employee profile linked to your account"
const MAX_MINUTES = 960 // 16 hours

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getMyEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { userId },
    select: { id: true, name: true },
  })
}

function computeMinutes(startedAt: Date, endedAt: Date): number {
  return Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))
}

/** Elapsed minutes of a running entry (floor, never negative). */
function elapsedMinutes(startedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60000))
}

/** Closes every running entry for the employee, storing derived minutes. */
async function closeRunningEntries(employeeId: string, now: Date) {
  const running = await prisma.timeEntry.findMany({
    where: { employeeId, endedAt: null },
    select: { id: true, startedAt: true },
  })
  for (const entry of running) {
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { endedAt: now, minutes: computeMinutes(entry.startedAt, now) },
    })
  }
  return running
}

function revalidateTimeViews() {
  revalidatePath("/timesheet")
  revalidatePath("/work-tracker")
}

type EntryWithNames = {
  id: string
  taskId: string | null
  clientId: string | null
  description: string | null
  startedAt: Date
  endedAt: Date | null
  minutes: number
  billable: boolean
  task: { title: string } | null
  client: { name: string } | null
}

function toTimesheetEntry(entry: EntryWithNames, now: Date): TimesheetEntry {
  const running = entry.endedAt === null
  return {
    id: entry.id,
    taskId: entry.taskId,
    taskTitle: entry.task?.title ?? null,
    clientId: entry.clientId,
    clientName: entry.client?.name ?? null,
    description: entry.description,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt ? entry.endedAt.toISOString() : null,
    minutes: running ? elapsedMinutes(entry.startedAt, now) : entry.minutes,
    billable: entry.billable,
    running,
  }
}

/** Parses "yyyy-MM-dd" (+ optional "HH:mm") into a local Date, or null. */
function parseLocalDateTime(date: string, time?: string): Date | null {
  const [y, mo, d] = date.split("-").map(Number)
  let h = 0
  let mi = 0
  if (time) {
    const parts = time.split(":").map(Number)
    h = parts[0]
    mi = parts[1]
  }
  const parsed = new Date(y, mo - 1, d, h, mi, 0, 0)
  // Reject silent rollover (e.g. 2026-13-40)
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== mo - 1 ||
    parsed.getDate() !== d
  ) {
    return null
  }
  return parsed
}

// ─── Manual-entry validation ──────────────────────────────────────────────────

const manualEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    minutes: z.number().int().min(1).max(MAX_MINUTES).optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time").optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid end time").optional(),
    taskId: z.string().optional(),
    clientId: z.string().optional(),
    description: z.string().max(500).optional(),
    billable: z.boolean(),
  })
  .refine((v) => v.minutes !== undefined || (v.startTime && v.endTime), {
    message: "Provide a duration or start and end times",
  })

export type ManualEntryInput = z.infer<typeof manualEntrySchema>

type ResolvedEntry = {
  startedAt: Date
  endedAt: Date
  minutes: number
  taskId: string | null
  clientId: string | null
  description: string | null
  billable: boolean
}

/** Shared add/update logic: validates, resolves times and the task→client link. */
async function resolveManualEntry(
  input: ManualEntryInput
): Promise<{ ok: true; data: ResolvedEntry } | { ok: false; error: string }> {
  const parsed = manualEntrySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid time entry",
    }
  }

  const { date, startTime, endTime, description, billable, taskId } = parsed.data
  let { minutes, clientId } = parsed.data

  let startedAt: Date | null
  let endedAt: Date

  if (startTime && endTime) {
    startedAt = parseLocalDateTime(date, startTime)
    const end = parseLocalDateTime(date, endTime)
    if (!startedAt || !end) return { ok: false, error: "Invalid date" }
    if (end.getTime() <= startedAt.getTime()) {
      return { ok: false, error: "End time must be after start time" }
    }
    endedAt = end
    minutes = computeMinutes(startedAt, endedAt)
  } else {
    // Duration-only entries anchor at 09:00 on the chosen day
    startedAt = parseLocalDateTime(date, "09:00")
    if (!startedAt) return { ok: false, error: "Invalid date" }
    endedAt = new Date(startedAt.getTime() + (minutes ?? 0) * 60000)
  }

  if (!minutes || minutes < 1 || minutes > MAX_MINUTES) {
    return { ok: false, error: "Duration must be between 1 minute and 16 hours" }
  }

  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { clientId: true },
    })
    if (!task) return { ok: false, error: "The selected task no longer exists" }
    clientId = task.clientId
  } else if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { id: true },
    })
    if (!client) return { ok: false, error: "The selected client no longer exists" }
  }

  return {
    ok: true,
    data: {
      startedAt,
      endedAt,
      minutes,
      taskId: taskId ?? null,
      clientId: clientId ?? null,
      description: description?.trim() || null,
      billable,
    },
  }
}

// ─── Timer actions ────────────────────────────────────────────────────────────

export async function getMyRunningTimer(): Promise<RunningTimer | null> {
  const session = await requireAuth()
  const me = await getMyEmployee(session.user.id)
  if (!me) return null

  const entry = await prisma.timeEntry.findFirst({
    where: { employeeId: me.id, endedAt: null },
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: { title: true } },
      client: { select: { name: true } },
    },
  })
  if (!entry) return null

  return {
    id: entry.id,
    taskId: entry.taskId,
    taskTitle: entry.task?.title ?? null,
    clientId: entry.clientId,
    clientName: entry.client?.name ?? null,
    description: entry.description,
    startedAt: entry.startedAt.toISOString(),
  }
}

export async function startTimer(input: {
  taskId?: string
  clientId?: string
  description?: string
}): Promise<TimeEntryActionResult> {
  try {
    const session = await requireAuth()
    const me = await getMyEmployee(session.user.id)
    if (!me) return { success: false, error: NO_EMPLOYEE_PROFILE }

    const taskId = input.taskId || undefined
    let clientId = input.clientId || undefined

    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { clientId: true },
      })
      if (!task) return { success: false, error: "Task not found" }
      clientId = task.clientId
    }

    const now = new Date()
    await closeRunningEntries(me.id, now)

    await prisma.timeEntry.create({
      data: {
        employeeId: me.id,
        taskId: taskId ?? null,
        clientId: clientId ?? null,
        description: input.description?.trim() || null,
        startedAt: now,
        endedAt: null,
        minutes: 0,
      },
    })

    revalidateTimeViews()
    return { success: true }
  } catch (error) {
    return { success: false, error: toUserError(error) }
  }
}

export async function stopTimer(): Promise<TimeEntryActionResult> {
  try {
    const session = await requireAuth()
    const me = await getMyEmployee(session.user.id)
    if (!me) return { success: false, error: NO_EMPLOYEE_PROFILE }

    const now = new Date()
    const closed = await closeRunningEntries(me.id, now)
    if (closed.length === 0) {
      return { success: false, error: "No timer is currently running" }
    }

    // Newest entry is the one the user sees as "the" timer
    const newest = closed.reduce((a, b) =>
      a.startedAt.getTime() >= b.startedAt.getTime() ? a : b
    )

    revalidateTimeViews()
    return { success: true, minutes: computeMinutes(newest.startedAt, now) }
  } catch (error) {
    return { success: false, error: toUserError(error) }
  }
}

// ─── Manual entries ───────────────────────────────────────────────────────────

export async function addManualEntry(
  input: ManualEntryInput
): Promise<TimeEntryActionResult> {
  try {
    const session = await requireAuth()
    const me = await getMyEmployee(session.user.id)
    if (!me) return { success: false, error: NO_EMPLOYEE_PROFILE }

    const resolved = await resolveManualEntry(input)
    if (!resolved.ok) return { success: false, error: resolved.error }

    await prisma.timeEntry.create({
      data: { employeeId: me.id, ...resolved.data },
    })

    revalidateTimeViews()
    return { success: true, minutes: resolved.data.minutes }
  } catch (error) {
    return { success: false, error: toUserError(error) }
  }
}

/** Own entries only; Partners may edit anyone's. */
export async function updateTimeEntry(
  entryId: string,
  input: ManualEntryInput
): Promise<TimeEntryActionResult> {
  try {
    const session = await requireAuth()

    const entry = await prisma.timeEntry.findUnique({
      where: { id: entryId },
      select: { id: true, employeeId: true, endedAt: true },
    })
    if (!entry) return { success: false, error: "Time entry not found" }

    // Employees may only edit their own entries; Managers/Partners can
    // correct any team member's timesheet (the review/correction layer).
    if (session.user.role === "EMPLOYEE") {
      const me = await getMyEmployee(session.user.id)
      if (!me) return { success: false, error: NO_EMPLOYEE_PROFILE }
      if (entry.employeeId !== me.id) {
        return { success: false, error: "You can only edit your own time entries" }
      }
    }

    if (!entry.endedAt) {
      return { success: false, error: "Stop the running timer before editing this entry" }
    }

    const resolved = await resolveManualEntry(input)
    if (!resolved.ok) return { success: false, error: resolved.error }

    await prisma.timeEntry.update({
      where: { id: entryId },
      data: resolved.data,
    })

    revalidateTimeViews()
    return { success: true, minutes: resolved.data.minutes }
  } catch (error) {
    return { success: false, error: toUserError(error) }
  }
}

/** Employees: own entries only; Managers/Partners may delete anyone's. */
export async function deleteTimeEntry(entryId: string): Promise<TimeEntryActionResult> {
  try {
    const session = await requireAuth()

    const entry = await prisma.timeEntry.findUnique({
      where: { id: entryId },
      select: { id: true, employeeId: true },
    })
    if (!entry) return { success: false, error: "Time entry not found" }

    if (session.user.role === "EMPLOYEE") {
      const me = await getMyEmployee(session.user.id)
      if (!me) return { success: false, error: NO_EMPLOYEE_PROFILE }
      if (entry.employeeId !== me.id) {
        return { success: false, error: "You can only delete your own time entries" }
      }
    }

    await prisma.timeEntry.delete({ where: { id: entryId } })

    revalidateTimeViews()
    return { success: true }
  } catch (error) {
    return { success: false, error: toUserError(error) }
  }
}

// ─── Timesheet queries ────────────────────────────────────────────────────────

/** Normalizes any "yyyy-MM-dd" to the Monday of its week (local time). */
function resolveWeekStart(weekStartISO: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartISO)) return null
  const parsed = parseLocalDateTime(weekStartISO)
  if (!parsed) return null
  return startOfWeek(parsed, { weekStartsOn: 1 })
}

export async function getMyTimesheet(
  weekStartISO: string
): Promise<MyTimesheet | { error: string }> {
  const session = await requireAuth()
  const me = await getMyEmployee(session.user.id)
  if (!me) return { error: NO_EMPLOYEE_PROFILE }

  const weekStart = resolveWeekStart(weekStartISO)
  if (!weekStart) return { error: "Invalid week" }
  const weekEnd = addDays(weekStart, 7)

  const rows = await prisma.timeEntry.findMany({
    where: {
      employeeId: me.id,
      startedAt: { gte: weekStart, lt: weekEnd },
    },
    include: {
      task: { select: { title: true } },
      client: { select: { name: true } },
    },
    orderBy: { startedAt: "asc" },
  })

  const now = new Date()
  const entries = rows.map((r) => toTimesheetEntry(r, now))

  const days: TimesheetDay[] = Array.from({ length: 7 }, (_, i) => {
    const key = format(addDays(weekStart, i), "yyyy-MM-dd")
    const dayEntries = entries.filter(
      (e) => format(new Date(e.startedAt), "yyyy-MM-dd") === key
    )
    return {
      date: key,
      totalMinutes: dayEntries.reduce((sum, e) => sum + e.minutes, 0),
      entries: dayEntries,
    }
  })

  const weekTotalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0)
  const billableMinutes = entries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + e.minutes, 0)

  return {
    weekStart: format(weekStart, "yyyy-MM-dd"),
    days,
    weekTotalMinutes,
    billableMinutes,
    nonBillableMinutes: weekTotalMinutes - billableMinutes,
  }
}

export async function getTeamTimesheet(
  weekStartISO: string
): Promise<{ weekStart: string; rows: TeamTimesheetRow[] } | { error: string }> {
  await requirePartnerOrManager()

  const weekStart = resolveWeekStart(weekStartISO)
  if (!weekStart) return { error: "Invalid week" }
  const weekEnd = addDays(weekStart, 7)

  const [employees, entries] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, department: true },
      orderBy: { name: "asc" },
    }),
    prisma.timeEntry.findMany({
      where: { startedAt: { gte: weekStart, lt: weekEnd } },
      select: {
        employeeId: true,
        minutes: true,
        billable: true,
        startedAt: true,
        endedAt: true,
      },
    }),
  ])

  const now = new Date()
  const totals = new Map<
    string,
    { total: number; billable: number; count: number }
  >()
  for (const e of entries) {
    const minutes = e.endedAt ? e.minutes : elapsedMinutes(e.startedAt, now)
    const agg = totals.get(e.employeeId) ?? { total: 0, billable: 0, count: 0 }
    agg.total += minutes
    if (e.billable) agg.billable += minutes
    agg.count += 1
    totals.set(e.employeeId, agg)
  }

  const rows: TeamTimesheetRow[] = employees
    .map((emp) => {
      const agg = totals.get(emp.id) ?? { total: 0, billable: 0, count: 0 }
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        totalMinutes: agg.total,
        billableMinutes: agg.billable,
        entryCount: agg.count,
      }
    })
    .sort((a, b) => b.totalMinutes - a.totalMinutes)

  return { weekStart: format(weekStart, "yyyy-MM-dd"), rows }
}

export async function getTaskTimeSummary(
  taskId: string
): Promise<TaskTimeSummary | null> {
  await requireAuth()

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, estimatedMinutes: true },
  })
  if (!task) return null

  const entries = await prisma.timeEntry.findMany({
    where: { taskId },
    include: { employee: { select: { id: true, name: true } } },
    orderBy: { startedAt: "desc" },
  })

  const now = new Date()
  let totalMinutes = 0
  const perPersonMap = new Map<string, { employeeName: string; minutes: number }>()

  for (const e of entries) {
    const minutes = e.endedAt ? e.minutes : elapsedMinutes(e.startedAt, now)
    totalMinutes += minutes
    const person = perPersonMap.get(e.employeeId) ?? {
      employeeName: e.employee.name,
      minutes: 0,
    }
    person.minutes += minutes
    perPersonMap.set(e.employeeId, person)
  }

  return {
    taskId: task.id,
    totalMinutes,
    estimatedMinutes: task.estimatedMinutes,
    perPerson: Array.from(perPersonMap.entries())
      .map(([employeeId, p]) => ({
        employeeId,
        employeeName: p.employeeName,
        minutes: p.minutes,
      }))
      .sort((a, b) => b.minutes - a.minutes),
    recentEntries: entries.slice(0, 3).map((e) => ({
      id: e.id,
      employeeName: e.employee.name,
      startedAt: e.startedAt.toISOString(),
      minutes: e.endedAt ? e.minutes : elapsedMinutes(e.startedAt, now),
      running: e.endedAt === null,
    })),
  }
}

/** Active clients + the caller's open tasks, for the add-entry dialog. */
export async function getTimesheetOptions(): Promise<TimesheetOptions> {
  const session = await requireAuth()
  const me = await getMyEmployee(session.user.id)

  const { getClientScopeWhere } = await import("@/lib/auth/scope")
  const [clients, tasks] = await Promise.all([
    prisma.client.findMany({
      // Employees log time against their assigned clients only.
      where: { ...(await getClientScopeWhere(session)), status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    me
      ? prisma.task.findMany({
          where: {
            assignedEmployeeId: me.id,
            status: { not: "FILED_DONE" },
          },
          select: {
            id: true,
            title: true,
            clientId: true,
            client: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ])

  return {
    clients,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      clientId: t.clientId,
      clientName: t.client.name,
    })),
  }
}

export type ActiveTaskDays = {
  id: string
  title: string
  clientName: string
  status: string
  acceptedAt: string | null
}

/**
 * The caller's accepted, not-yet-completed tasks with their acceptance date, so
 * the timesheet can show how many days they've been working each one.
 */
export async function getMyActiveTasks(): Promise<ActiveTaskDays[]> {
  const session = await requireAuth()
  const employee = await getMyEmployee(session.user.id)
  if (!employee) return []

  const tasks = await prisma.task.findMany({
    where: {
      assignedEmployeeId: employee.id,
      acceptanceStatus: "ACCEPTED",
      status: { not: "FILED_DONE" },
      acceptedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      status: true,
      acceptedAt: true,
      client: { select: { name: true } },
    },
    orderBy: { acceptedAt: "asc" },
  })

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    clientName: t.client.name,
    status: t.status,
    acceptedAt: t.acceptedAt ? t.acceptedAt.toISOString() : null,
  }))
}

// ─── Billing time ────────────────────────────────────────────────────────────

export type UnbilledTime = {
  clientId: string
  clientName: string
  /** Billable, not-yet-invoiced minutes. */
  minutes: number
  /** minutes × the person's rate, summed. Zero where nobody has a rate set. */
  amount: number
  byEmployee: Array<{
    employeeId: string
    employeeName: string
    minutes: number
    ratePerHour: number | null
    amount: number
  }>
  /** True when some of the time cannot be priced — the caller must say so. */
  hasUnratedTime: boolean
}

/**
 * Billable time on a client that has not been invoiced yet.
 *
 * TimeEntry.billable has existed from the start with nothing to multiply it by
 * — no rate on the employee, no rate on the engagement, and no route from
 * minutes to an invoice line. So the timesheet measured cost and never touched
 * revenue.
 */
export async function getUnbilledTime(clientId: string): Promise<UnbilledTime | null> {
  const session = await requirePartnerOrManager()
  if (!clientId) return null

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  })
  if (!client) return null

  const entries = await prisma.timeEntry.findMany({
    where: {
      // TimeEntry carries a firmId of its own, so the tenant extension scopes
      // this; clientId narrows it to the one client.
      clientId,
      billable: true,
      invoiceId: null,
      endedAt: { not: null },
    },
    select: {
      minutes: true,
      employeeId: true,
      employee: { select: { name: true, billingRatePerHour: true } },
    },
  })

  const byEmployee = new Map<
    string,
    { employeeId: string; employeeName: string; minutes: number; ratePerHour: number | null }
  >()

  for (const e of entries) {
    const existing = byEmployee.get(e.employeeId)
    if (existing) {
      existing.minutes += e.minutes
    } else {
      byEmployee.set(e.employeeId, {
        employeeId: e.employeeId,
        employeeName: e.employee.name,
        minutes: e.minutes,
        ratePerHour:
          e.employee.billingRatePerHour != null
            ? Number(e.employee.billingRatePerHour)
            : null,
      })
    }
  }

  const rows = [...byEmployee.values()].map((r) => ({
    ...r,
    // Rounded to the paisa, not the rupee — an invoice total that doesn't
    // reconcile to its own lines is worse than an awkward number.
    amount: r.ratePerHour ? Math.round((r.minutes / 60) * r.ratePerHour * 100) / 100 : 0,
  }))

  void session
  return {
    clientId: client.id,
    clientName: client.name,
    minutes: rows.reduce((s, r) => s + r.minutes, 0),
    amount: rows.reduce((s, r) => s + r.amount, 0),
    byEmployee: rows.sort((a, b) => b.minutes - a.minutes),
    hasUnratedTime: rows.some((r) => r.ratePerHour == null && r.minutes > 0),
  }
}

/**
 * Attach a client's unbilled time to an invoice.
 *
 * Called after the invoice exists, so the entries carry its id and can never be
 * billed a second time. Deliberately marks ALL currently-unbilled billable time
 * for the client: partial selection would leave the remainder looking unbilled
 * when it had in fact been folded into the same fee.
 */
export async function markTimeBilled(
  clientId: string,
  invoiceId: string
): Promise<{ success: boolean; entries: number; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, entries: 0, error: "Permission denied." }
  }

  try {
    const result = await prisma.timeEntry.updateMany({
      where: { clientId, billable: true, invoiceId: null, endedAt: { not: null } },
      data: { invoiceId, invoicedAt: new Date() },
    })
    revalidatePath("/timesheet")
    revalidatePath(`/clients/${clientId}`)
    return { success: true, entries: result.count }
  } catch (error) {
    console.error("Failed to mark time billed:", error)
    return { success: false, entries: 0, error: "Could not link the time to the invoice." }
  }
}
