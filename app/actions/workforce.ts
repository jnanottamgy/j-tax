"use server"

import { requirePartner } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays, format } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmployeeStatus = "ONLINE" | "IDLE" | "OFFLINE" | "ON_LEAVE"

export type EmployeeStatusCard = {
  id: string
  name: string
  email: string
  department: string | null
  isActive: boolean
  status: EmployeeStatus
  lastActiveAt: Date | null
  loginAt: Date | null
  sessionDurationMinutes: number
  todayActiveMinutes: number
  weekActiveMinutes: number
}

export type PerformanceMetrics = {
  employeeId: string
  employeeName: string
  department: string | null
  tasksAssigned: number
  tasksCompleted: number
  completionRate: number
  overdueTasks: number
  activeClients: number
  documentsProcessed: number
  complianceFilings: number
  revenueManaged: number
  avgCompletionDays: number
  performanceScore: number
}

export type TimelineEntry = {
  id: string
  activityType: string
  description: string
  entityType: string | null
  entityId: string | null
  entityName: string | null
  performedAt: Date
  metadata: Record<string, unknown> | null
}

export type AttendanceSummary = {
  employeeId: string
  employeeName: string
  department: string | null
  present: number
  absent: number
  lateLogin: number
  halfDay: number
  onLeave: number
  totalWorkingDays: number
  avgDailyMinutes: number
  attendanceRate: number
}

export type WorkloadAlert = {
  employeeId: string
  employeeName: string
  department: string | null
  alertType: "OVERLOADED" | "UNDERUTILIZED" | "EXCESSIVE_OVERDUE" | "NO_ACTIVITY"
  message: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  value: number
}

// ─── Dashboard Overview ───────────────────────────────────────────────────────

export async function getWorkforceDashboard() {
  await requirePartner()

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const idleThresholdMs = 15 * 60 * 1000 // 15 minutes

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      isActive: true,
      sessions: {
        where: { isActive: true },
        orderBy: { loginAt: "desc" },
        take: 1,
      },
      attendanceRecords: {
        where: { date: { gte: todayStart } },
        take: 1,
      },
      tasks: {
        select: {
          status: true,
          isOverdue: true,
          dueDate: true,
        },
      },
    },
    orderBy: { name: "asc" },
  })

  // Today's session minutes per employee
  const todaySessions = await prisma.employeeSession.groupBy({
    by: ["employeeId"],
    where: {
      loginAt: { gte: todayStart, lte: todayEnd },
    },
    _sum: { durationMinutes: true },
  })
  const todayMinutesMap = new Map(
    todaySessions.map((s) => [s.employeeId, s._sum.durationMinutes ?? 0])
  )

  // Week session minutes per employee
  const weekSessions = await prisma.employeeSession.groupBy({
    by: ["employeeId"],
    where: {
      loginAt: { gte: weekStart, lte: now },
    },
    _sum: { durationMinutes: true },
  })
  const weekMinutesMap = new Map(
    weekSessions.map((s) => [s.employeeId, s._sum.durationMinutes ?? 0])
  )

  const statusCards: EmployeeStatusCard[] = employees.map((emp) => {
    const activeSession = emp.sessions[0] ?? null
    let status: EmployeeStatus = "OFFLINE"

    if (activeSession) {
      const idleSince = now.getTime() - new Date(activeSession.lastActiveAt).getTime()
      status = idleSince > idleThresholdMs ? "IDLE" : "ONLINE"
    } else if (emp.attendanceRecords[0]?.status === "ON_LEAVE") {
      status = "ON_LEAVE"
    }

    // Add active session duration to today total
    const activeMins = activeSession
      ? Math.round((now.getTime() - new Date(activeSession.loginAt).getTime()) / 60000)
      : 0

    return {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      department: emp.department,
      isActive: emp.isActive,
      status,
      lastActiveAt: activeSession ? new Date(activeSession.lastActiveAt) : null,
      loginAt: activeSession ? new Date(activeSession.loginAt) : null,
      sessionDurationMinutes: activeMins,
      todayActiveMinutes: (todayMinutesMap.get(emp.id) ?? 0) + activeMins,
      weekActiveMinutes: (weekMinutesMap.get(emp.id) ?? 0) + activeMins,
    }
  })

  // Team summary
  const online = statusCards.filter((e) => e.status === "ONLINE").length
  const idle = statusCards.filter((e) => e.status === "IDLE").length
  const offline = statusCards.filter((e) => e.status === "OFFLINE").length
  const onLeave = statusCards.filter((e) => e.status === "ON_LEAVE").length

  return {
    statusCards,
    summary: { online, idle, offline, onLeave, total: employees.length },
  }
}

// ─── Performance Metrics ──────────────────────────────────────────────────────

export async function getPerformanceMetrics(
  period: "day" | "week" | "month" | "quarter" = "month"
) {
  await requirePartner()

  const now = new Date()
  let rangeStart: Date
  switch (period) {
    case "day":   rangeStart = startOfDay(now); break
    case "week":  rangeStart = startOfWeek(now, { weekStartsOn: 1 }); break
    case "quarter": rangeStart = startOfQuarter(now); break
    default:      rangeStart = startOfMonth(now)
  }

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      department: true,
      tasks: {
        select: {
          status: true,
          isOverdue: true,
          dueDate: true,
          completionDate: true,
          createdAt: true,
        },
      },
      clients: {
        select: { id: true },
      },
    },
  })

  // Documents per employee (via uploadedBy userId)
  const employeeUserIds = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, userId: true },
  })
  const userIdToEmpId = new Map(
    employeeUserIds.filter((e) => e.userId).map((e) => [e.userId!, e.id])
  )

  const docCounts = await prisma.document.groupBy({
    by: ["uploadedBy"],
    where: { createdAt: { gte: rangeStart } },
    _count: true,
  })
  const docCountMap = new Map<string, number>()
  for (const d of docCounts) {
    const empId = userIdToEmpId.get(d.uploadedBy)
    if (empId) docCountMap.set(empId, (docCountMap.get(empId) ?? 0) + d._count)
  }

  // Compliance completions per client assigned to employee
  const complianceCounts = await prisma.complianceEvent.groupBy({
    by: ["clientId"],
    where: {
      status: "COMPLETED",
      completedAt: { gte: rangeStart },
      clientId: { not: null },
    },
    _count: true,
  })
  const clientToEmpId = new Map<string, string>()
  const allClients = await prisma.client.findMany({
    where: { assignedEmployeeId: { not: null } },
    select: { id: true, assignedEmployeeId: true },
  })
  for (const c of allClients) {
    if (c.assignedEmployeeId) clientToEmpId.set(c.id, c.assignedEmployeeId)
  }
  const complianceCountMap = new Map<string, number>()
  for (const cc of complianceCounts) {
    if (!cc.clientId) continue
    const empId = clientToEmpId.get(cc.clientId)
    if (empId) complianceCountMap.set(empId, (complianceCountMap.get(empId) ?? 0) + cc._count)
  }

  // Revenue per employee (sum of paid invoices for their clients)
  const revenueData = await prisma.invoice.groupBy({
    by: ["clientId"],
    where: {
      status: { in: ["PAID", "PARTIALLY_PAID"] },
      createdAt: { gte: rangeStart },
    },
    _sum: { paidAmount: true },
  })
  const revenueMap = new Map<string, number>()
  for (const r of revenueData) {
    const empId = clientToEmpId.get(r.clientId)
    if (empId) {
      revenueMap.set(empId, (revenueMap.get(empId) ?? 0) + Number(r._sum.paidAmount ?? 0))
    }
  }

  const metrics: PerformanceMetrics[] = employees.map((emp) => {
    const periodTasks = emp.tasks.filter((t) => new Date(t.createdAt) >= rangeStart)
    const assigned = periodTasks.length
    const completed = periodTasks.filter((t) => t.status === "FILED_DONE").length
    const overdue = periodTasks.filter((t) => t.isOverdue).length
    const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0

    // Average days to complete
    const completedWithDates = periodTasks.filter(
      (t) => t.status === "FILED_DONE" && t.completionDate && t.createdAt
    )
    const avgDays = completedWithDates.length > 0
      ? Math.round(
          completedWithDates.reduce((sum, t) => {
            const days = (new Date(t.completionDate!).getTime() - new Date(t.createdAt).getTime()) / 86400000
            return sum + days
          }, 0) / completedWithDates.length
        )
      : 0

    // Performance score (0-100)
    const score = Math.min(
      100,
      Math.round(
        completionRate * 0.4 +
        Math.min(100, (emp.clients.length / 10) * 100) * 0.2 +
        Math.min(100, (docCountMap.get(emp.id) ?? 0) * 5) * 0.2 +
        Math.max(0, 100 - overdue * 10) * 0.2
      )
    )

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      tasksAssigned: assigned,
      tasksCompleted: completed,
      completionRate,
      overdueTasks: overdue,
      activeClients: emp.clients.length,
      documentsProcessed: docCountMap.get(emp.id) ?? 0,
      complianceFilings: complianceCountMap.get(emp.id) ?? 0,
      revenueManaged: revenueMap.get(emp.id) ?? 0,
      avgCompletionDays: avgDays,
      performanceScore: score,
    }
  })

  return metrics.sort((a, b) => b.performanceScore - a.performanceScore)
}

// ─── Employee Timeline ────────────────────────────────────────────────────────

export async function getEmployeeTimeline(
  employeeId: string,
  filter: "today" | "week" | "month" | "custom" = "today",
  startDate?: string,
  endDate?: string,
  page = 1,
  pageSize = 50
) {
  await requirePartner()

  const now = new Date()
  let rangeStart: Date
  let rangeEnd: Date = now

  switch (filter) {
    case "week":
      rangeStart = startOfWeek(now, { weekStartsOn: 1 })
      break
    case "month":
      rangeStart = startOfMonth(now)
      break
    case "custom":
      rangeStart = startDate ? new Date(startDate) : subDays(now, 30)
      rangeEnd = endDate ? new Date(endDate) : now
      break
    default:
      rangeStart = startOfDay(now)
  }

  const [activities, total] = await Promise.all([
    prisma.employeeActivity.findMany({
      where: {
        employeeId,
        performedAt: { gte: rangeStart, lte: rangeEnd },
      },
      orderBy: { performedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employeeActivity.count({
      where: {
        employeeId,
        performedAt: { gte: rangeStart, lte: rangeEnd },
      },
    }),
  ])

  return {
    activities: activities.map((a) => ({
      ...a,
      metadata: a.metadata as Record<string, unknown> | null,
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  }
}

// ─── Employee Detail ──────────────────────────────────────────────────────────

export async function getEmployeeDetail(employeeId: string) {
  await requirePartner()

  const now = new Date()
  const thirtyDaysAgo = subDays(now, 30)

  const [employee, recentSessions, tasks, todayAttendance] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.employeeSession.findMany({
      where: { employeeId, loginAt: { gte: thirtyDaysAgo } },
      orderBy: { loginAt: "desc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: { assignedEmployeeId: employeeId },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        isOverdue: true,
        client: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.attendanceRecord.findFirst({
      where: { employeeId, date: startOfDay(now) },
    }),
  ])

  if (!employee) return null

  // Active session check
  const activeSession = await prisma.employeeSession.findFirst({
    where: { employeeId, isActive: true },
  })

  const idleThresholdMs = 15 * 60 * 1000
  let status: EmployeeStatus = "OFFLINE"
  if (activeSession) {
    const idleSince = now.getTime() - new Date(activeSession.lastActiveAt).getTime()
    status = idleSince > idleThresholdMs ? "IDLE" : "ONLINE"
  }

  return {
    employee,
    status,
    activeSession,
    todayAttendance,
    tasks,
    recentSessions,
  }
}

// ─── Attendance Report ────────────────────────────────────────────────────────

export async function getAttendanceReport(
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth() + 1
) {
  await requirePartner()

  const rangeStart = new Date(Date.UTC(year, month - 1, 1))
  const rangeEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59))
  const workingDays = countWorkingDays(rangeStart, rangeEnd)

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, department: true },
    orderBy: { name: "asc" },
  })

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: rangeStart, lte: rangeEnd },
    },
    select: {
      employeeId: true,
      status: true,
      workMinutes: true,
    },
  })

  const byEmployee = new Map<string, typeof records>()
  for (const r of records) {
    if (!byEmployee.has(r.employeeId)) byEmployee.set(r.employeeId, [])
    byEmployee.get(r.employeeId)!.push(r)
  }

  const summaries: AttendanceSummary[] = employees.map((emp) => {
    const empRecords = byEmployee.get(emp.id) ?? []
    const present = empRecords.filter((r) => r.status === "PRESENT").length
    const absent = empRecords.filter((r) => r.status === "ABSENT").length
    const lateLogin = empRecords.filter((r) => r.status === "LATE_LOGIN").length
    const halfDay = empRecords.filter((r) => r.status === "HALF_DAY").length
    const onLeave = empRecords.filter((r) => r.status === "ON_LEAVE").length

    const totalMins = empRecords.reduce((sum, r) => sum + (r.workMinutes ?? 0), 0)
    const daysWorked = present + lateLogin + halfDay
    const avgMins = daysWorked > 0 ? Math.round(totalMins / daysWorked) : 0
    const attendanceRate = workingDays > 0
      ? Math.round(((present + lateLogin + halfDay) / workingDays) * 100)
      : 0

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      present,
      absent,
      lateLogin,
      halfDay,
      onLeave,
      totalWorkingDays: workingDays,
      avgDailyMinutes: avgMins,
      attendanceRate,
    }
  })

  return { summaries, month, year, workingDays }
}

// ─── Daily Attendance Records ─────────────────────────────────────────────────

export async function getDailyAttendance(
  year: number,
  month: number,
  employeeId?: string
) {
  await requirePartner()

  const rangeStart = new Date(Date.UTC(year, month - 1, 1))
  const rangeEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59))

  const where: Record<string, unknown> = {
    date: { gte: rangeStart, lte: rangeEnd },
  }
  if (employeeId) where.employeeId = employeeId

  return prisma.attendanceRecord.findMany({
    where,
    include: { employee: { select: { name: true, department: true } } },
    orderBy: [{ date: "desc" }, { employee: { name: "asc" } }],
  })
}

// ─── Workload Alerts ──────────────────────────────────────────────────────────

export async function getWorkloadAlerts(): Promise<WorkloadAlert[]> {
  await requirePartner()

  const now = new Date()
  const sevenDaysAgo = subDays(now, 7)
  const alerts: WorkloadAlert[] = []

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      department: true,
      tasks: {
        select: { status: true, isOverdue: true },
      },
    },
  })

  // Recent activity count per employee
  const recentActivity = await prisma.employeeActivity.groupBy({
    by: ["employeeId"],
    where: { performedAt: { gte: sevenDaysAgo } },
    _count: true,
  })
  const activityMap = new Map(recentActivity.map((a) => [a.employeeId, a._count]))

  for (const emp of employees) {
    const activeTasks = emp.tasks.filter(
      (t) => t.status !== "FILED_DONE" && t.status !== "ON_HOLD"
    ).length
    const overdueTasks = emp.tasks.filter((t) => t.isOverdue).length
    const recentActions = activityMap.get(emp.id) ?? 0

    if (activeTasks > 20) {
      alerts.push({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        alertType: "OVERLOADED",
        message: `${emp.name} has ${activeTasks} active tasks — significantly overloaded`,
        severity: activeTasks > 30 ? "HIGH" : "MEDIUM",
        value: activeTasks,
      })
    }

    if (overdueTasks > 5) {
      alerts.push({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        alertType: "EXCESSIVE_OVERDUE",
        message: `${emp.name} has ${overdueTasks} overdue tasks requiring attention`,
        severity: overdueTasks > 10 ? "HIGH" : "MEDIUM",
        value: overdueTasks,
      })
    }

    if (activeTasks < 2 && recentActions < 5) {
      alerts.push({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        alertType: "UNDERUTILIZED",
        message: `${emp.name} has ${activeTasks} tasks and ${recentActions} actions in 7 days`,
        severity: "LOW",
        value: activeTasks,
      })
    }

    if (recentActions === 0) {
      alerts.push({
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        alertType: "NO_ACTIVITY",
        message: `${emp.name} has had no recorded activity in the past 7 days`,
        severity: "HIGH",
        value: 0,
      })
    }
  }

  return alerts.sort((a, b) => {
    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

// ─── Productivity Chart Data ──────────────────────────────────────────────────

export async function getProductivityChartData(
  employeeId: string,
  period: "week" | "month" = "week"
) {
  await requirePartner()

  const now = new Date()
  const rangeStart = period === "week"
    ? startOfWeek(now, { weekStartsOn: 1 })
    : startOfMonth(now)

  const activities = await prisma.employeeActivity.findMany({
    where: {
      employeeId,
      performedAt: { gte: rangeStart },
    },
    select: { performedAt: true, activityType: true },
    orderBy: { performedAt: "asc" },
  })

  const sessions = await prisma.employeeSession.findMany({
    where: {
      employeeId,
      loginAt: { gte: rangeStart },
    },
    select: { loginAt: true, durationMinutes: true },
  })

  // Group by day
  const dayMap = new Map<string, { actions: number; minutes: number }>()

  for (const a of activities) {
    const day = format(new Date(a.performedAt), "yyyy-MM-dd")
    const entry = dayMap.get(day) ?? { actions: 0, minutes: 0 }
    dayMap.set(day, { ...entry, actions: entry.actions + 1 })
  }

  for (const s of sessions) {
    const day = format(new Date(s.loginAt), "yyyy-MM-dd")
    const entry = dayMap.get(day) ?? { actions: 0, minutes: 0 }
    dayMap.set(day, { ...entry, minutes: entry.minutes + (s.durationMinutes ?? 0) })
  }

  const data = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      label: format(new Date(date), "EEE dd"),
      actions: vals.actions,
      activeMinutes: vals.minutes,
    }))

  return data
}

// ─── Team Comparison ──────────────────────────────────────────────────────────

export async function getTeamComparisonData(period: "week" | "month" = "month") {
  await requirePartner()

  const now = new Date()
  const rangeStart = period === "week"
    ? startOfWeek(now, { weekStartsOn: 1 })
    : startOfMonth(now)

  const activityCounts = await prisma.employeeActivity.groupBy({
    by: ["employeeId"],
    where: { performedAt: { gte: rangeStart } },
    _count: true,
  })

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, department: true },
  })

  const empMap = new Map(employees.map((e) => [e.id, e]))
  const countMap = new Map(activityCounts.map((a) => [a.employeeId, a._count]))

  return employees
    .map((emp) => ({
      employeeId: emp.id,
      name: emp.name,
      department: emp.department,
      actionCount: countMap.get(emp.id) ?? 0,
    }))
    .sort((a, b) => b.actionCount - a.actionCount)
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function countWorkingDays(start: Date, end: Date): number {
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getUTCDay()
    if (day !== 0 && day !== 6) count++
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return count
}

// ─── Heartbeat (called from client to update last active) ────────────────────

export async function recordHeartbeat() {
  const { getSession } = await import("@/lib/auth/session")
  const session = await getSession()
  if (!session) return

  const { updateSessionLastActive, getEmployeeByUserId } = await import("@/lib/workforce/tracker")
  const employee = await getEmployeeByUserId(session.user.id)
  if (employee) {
    await updateSessionLastActive(employee.id)
  }
}
