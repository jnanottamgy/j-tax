import { prisma } from "@/lib/prisma"
import type { EmployeeActivityType } from "@prisma/client"

// ─── Activity Tracking ────────────────────────────────────────────────────────

export interface TrackActivityOptions {
  employeeId: string
  userId: string
  activityType: EmployeeActivityType
  description: string
  entityType?: string
  entityId?: string
  entityName?: string
  metadata?: Record<string, string | number | boolean | null>
}

export async function trackEmployeeActivity(opts: TrackActivityOptions): Promise<void> {
  try {
    await prisma.employeeActivity.create({
      data: {
        employeeId: opts.employeeId,
        userId: opts.userId,
        activityType: opts.activityType,
        description: opts.description,
        entityType: opts.entityType,
        entityId: opts.entityId,
        entityName: opts.entityName,
        metadata: opts.metadata ?? undefined,
      },
    })
  } catch (err) {
    console.error("[workforce] Failed to track activity:", err)
  }
}

// ─── Session Management ───────────────────────────────────────────────────────

export async function startEmployeeSession(
  employeeId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    // Close any open sessions first
    await prisma.employeeSession.updateMany({
      where: { employeeId, isActive: true },
      data: {
        isActive: false,
        logoutAt: new Date(),
        durationMinutes: undefined,
      },
    })

    const now = new Date()
    await prisma.employeeSession.create({
      data: {
        employeeId,
        userId,
        loginAt: now,
        lastActiveAt: now,
        isActive: true,
        ipAddress,
        userAgent,
      },
    })

    // Auto-create/update attendance record
    await upsertAttendanceOnLogin(employeeId, now)
  } catch (err) {
    console.error("[workforce] Failed to start session:", err)
  }
}

export async function endEmployeeSession(employeeId: string): Promise<void> {
  try {
    const session = await prisma.employeeSession.findFirst({
      where: { employeeId, isActive: true },
      orderBy: { loginAt: "desc" },
    })

    if (!session) return

    const now = new Date()
    const durationMinutes = Math.round(
      (now.getTime() - session.loginAt.getTime()) / 60000
    )

    await prisma.employeeSession.update({
      where: { id: session.id },
      data: {
        isActive: false,
        logoutAt: now,
        durationMinutes,
      },
    })

    // Update attendance record with logout time
    const dateKey = toDateKey(session.loginAt)
    await prisma.attendanceRecord.updateMany({
      where: { employeeId, date: dateKey },
      data: {
        logoutAt: now,
        workMinutes: {
          increment: durationMinutes,
        },
      },
    })
  } catch (err) {
    console.error("[workforce] Failed to end session:", err)
  }
}

export async function updateSessionLastActive(employeeId: string): Promise<void> {
  try {
    await prisma.employeeSession.updateMany({
      where: { employeeId, isActive: true },
      data: { lastActiveAt: new Date() },
    })
  } catch (err) {
    console.error("[workforce] Failed to update last active:", err)
  }
}

// ─── Attendance ───────────────────────────────────────────────────────────────

// Work day starts at 09:30 IST = 04:00 UTC. Login after that is "late".
const LATE_LOGIN_HOUR_UTC = 4 // 09:30 IST = 04:00 UTC

async function upsertAttendanceOnLogin(
  employeeId: string,
  loginAt: Date
): Promise<void> {
  const dateKey = toDateKey(loginAt)
  const hour = loginAt.getUTCHours()
  const minute = loginAt.getUTCMinutes()
  const isLate = hour > LATE_LOGIN_HOUR_UTC || (hour === LATE_LOGIN_HOUR_UTC && minute > 0)

  await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date: dateKey } },
    create: {
      employeeId,
      date: dateKey,
      status: isLate ? "LATE_LOGIN" : "PRESENT",
      loginAt,
    },
    update: {
      loginAt,
      status: isLate ? "LATE_LOGIN" : "PRESENT",
    },
  })
}

/** Returns midnight UTC for a given date — used as the attendance date key */
export function toDateKey(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  )
}

// ─── Helpers to get employee context from userId ──────────────────────────────

export async function getEmployeeByUserId(
  userId: string
): Promise<{ id: string; name: string } | null> {
  return prisma.employee.findFirst({
    where: { userId },
    select: { id: true, name: true },
  })
}
