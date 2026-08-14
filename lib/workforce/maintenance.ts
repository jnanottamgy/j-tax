import { prisma } from "@/lib/prisma"
import { toDateKey } from "@/lib/workforce/tracker"

/**
 * Keeping the attendance record honest between logins.
 *
 * Both of these run nightly. Neither can be done at login time, because the
 * whole point is the days when nobody logs in.
 */

/** Session rows older than this are dropped. */
export const SESSION_RETENTION_DAYS = 400

/**
 * Write approved leave into attendance.
 *
 * Attendance had an ON_LEAVE status that nothing ever set, so approved leave
 * showed as plain absence and the "on leave" count on the dashboard was
 * permanently zero. Covers yesterday and today rather than the whole period,
 * so the job is small and idempotent — leave approved retrospectively is
 * picked up by the backfill on the leave record itself.
 */
export async function markLeaveAttendance(now = new Date()): Promise<number> {
  const today = toDateKey(now)
  const yesterday = toDateKey(new Date(now.getTime() - 86_400_000))

  const leave = await prisma.employeeLeave.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: today },
      endDate: { gte: yesterday },
    },
    select: { employeeId: true },
  })
  if (leave.length === 0) return 0

  let written = 0
  for (const day of [yesterday, today]) {
    for (const l of leave) {
      // Never overwrite a day somebody actually worked — leave approved over a
      // day they came in anyway is a question for a human, not something to
      // silently erase.
      const existing = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: l.employeeId, date: day } },
        select: { id: true, loginAt: true },
      })
      if (existing?.loginAt) continue

      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: l.employeeId, date: day } },
        create: { employeeId: l.employeeId, date: day, status: "ON_LEAVE" },
        update: { status: "ON_LEAVE" },
      })
      written++
    }
  }
  return written
}

/**
 * Drop session rows past the retention window.
 *
 * Each row holds an IP address and a user agent. Just over a year keeps a full
 * appraisal cycle and the previous one for comparison; beyond that it is
 * personal data with no use. Attendance records are the durable summary and are
 * deliberately left alone — payroll may need them for years.
 */
export async function purgeOldSessions(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * 86_400_000)
  const result = await prisma.employeeSession.deleteMany({
    where: { isActive: false, loginAt: { lt: cutoff } },
  })
  return result.count
}

/**
 * Tell the partners who has not turned up.
 *
 * The workforce dashboard is pull-only: nothing ever said anything, so noticing
 * an absence depended on somebody remembering to open a page. This runs once
 * mid-morning and reports only what is actually unexpected — people who are
 * neither present nor on approved leave, on a day the firm works.
 *
 * Silent when everybody is in, which is most days. An alert that fires every
 * morning is one nobody reads.
 */
export async function reportUnexpectedAbsences(now = new Date()): Promise<number> {
  const { getAttendanceRules, isWorkingDay } = await import(
    "@/lib/workforce/attendance-rules"
  )
  const rules = await getAttendanceRules()
  if (!isWorkingDay(now, rules)) return 0

  const today = toDateKey(now)

  const [employees, attended, onLeave] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: today },
      select: { employeeId: true },
    }),
    prisma.employeeLeave.findMany({
      where: {
        status: { in: ["REQUESTED", "APPROVED"] },
        startDate: { lte: now },
        endDate: { gte: today },
      },
      select: { employeeId: true },
    }),
  ])

  const accountedFor = new Set([
    ...attended.map((a) => a.employeeId),
    ...onLeave.map((l) => l.employeeId),
  ])
  const missing = employees.filter((e) => !accountedFor.has(e.id))
  if (missing.length === 0) return 0

  const { notifyRoles } = await import("@/lib/notifications/notify")
  await notifyRoles(["PARTNER", "MANAGER"], {
    title: `${missing.length} not signed in today`,
    message: `${missing.map((m) => m.name).join(", ")} ${
      missing.length === 1 ? "has" : "have"
    } not signed in and ${missing.length === 1 ? "is" : "are"} not on recorded leave.`,
    type: "WARNING",
  })

  return missing.length
}
