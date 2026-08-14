import { prisma } from "@/lib/prisma"
import {
  STALE_AFTER_MINUTES,
  closingTimeFor,
  creditForBeat,
  isStale,
} from "@/lib/workforce/presence"
import type { EmployeeActivityType } from "@prisma/client"
import { getAttendanceRules, isLateArrival } from "@/lib/workforce/attendance-rules"

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
    // Close any open sessions first — properly.
    //
    // This used to updateMany with `durationMinutes: undefined`, which Prisma
    // reads as "leave it alone", so the previous session's minutes stayed null
    // and its day's workMinutes were never written. Every day somebody closed
    // the tab instead of signing out recorded zero hours. Closing them one by
    // one costs a query per stale session — there is at most one in practice —
    // and keeps the time.
    await closeOpenSessions(employeeId)

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

/**
 * Close every open session for someone, keeping the time they earned.
 *
 * Used by explicit sign-out, by the next login, and by the stale sweep — so
 * there is exactly one place that knows how a session ends and what it is
 * worth. `explicit` distinguishes "they clicked Sign out just now" from "the
 * beats stopped a while ago": the first closes at this moment, the second at
 * the last beat, because that is when the person actually left.
 */
export async function closeOpenSessions(
  employeeId: string,
  opts?: { explicit?: boolean }
): Promise<void> {
  const open = await prisma.employeeSession.findMany({
    where: { employeeId, isActive: true },
    orderBy: { loginAt: "desc" },
  })
  if (open.length === 0) return

  const now = new Date()

  for (const session of open) {
    // Credit the stretch since the last beat, so signing out immediately after
    // one does not silently drop those minutes.
    const trailing = creditForBeat(session.lastActiveAt, now)
    const minutes = session.activeMinutes + (opts?.explicit ? trailing : 0)
    const logoutAt = opts?.explicit ? now : closingTimeFor(session.lastActiveAt)

    await prisma.employeeSession.update({
      where: { id: session.id },
      data: {
        isActive: false,
        logoutAt,
        activeMinutes: minutes,
        durationMinutes: minutes,
      },
    })

    // Attendance is credited against the day the session began, so an evening
    // that runs past midnight lands on the day it belongs to.
    const dateKey = toDateKey(session.loginAt)
    await prisma.attendanceRecord.updateMany({
      where: { employeeId, date: dateKey },
      data: { logoutAt, workMinutes: { increment: minutes } },
    })
  }
}

export async function endEmployeeSession(employeeId: string): Promise<void> {
  try {
    await closeOpenSessions(employeeId, { explicit: true })
  } catch (err) {
    console.error("[workforce] Failed to end session:", err)
  }
}

/**
 * A heartbeat: the person is here now, and has been since the last beat.
 *
 * This used to only stamp `lastActiveAt`, which meant the app collected a
 * five-minute presence signal and then measured hours off login/logout anyway.
 * The beat now carries the minutes.
 */
export async function updateSessionLastActive(employeeId: string): Promise<void> {
  try {
    const session = await prisma.employeeSession.findFirst({
      where: { employeeId, isActive: true },
      orderBy: { loginAt: "desc" },
      select: { id: true, lastActiveAt: true, loginAt: true },
    })
    if (!session) return

    const now = new Date()

    // A beat after a long silence is somebody coming back, not somebody who
    // was here the whole time. Close the quiet session at its last beat and
    // open a fresh one, so the gap is not credited and the day still adds up.
    if (isStale(session.lastActiveAt, now)) {
      await closeOpenSessions(employeeId)
      return
    }

    await prisma.employeeSession.update({
      where: { id: session.id },
      data: {
        lastActiveAt: now,
        activeMinutes: { increment: creditForBeat(session.lastActiveAt, now) },
      },
    })
  } catch (err) {
    console.error("[workforce] Failed to update last active:", err)
  }
}

/**
 * Close sessions whose beats stopped, across the whole firm.
 *
 * The backstop for a tab closed without signing out: the sweep books the time
 * up to the last beat and marks the session over, so the day's hours are
 * recorded even though nobody ever pressed anything. Runs from the nightly
 * cron and is safe to run at any time.
 */
export async function sweepStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000)
  const stale = await prisma.employeeSession.findMany({
    where: { isActive: true, lastActiveAt: { lt: cutoff } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  })

  for (const s of stale) {
    await closeOpenSessions(s.employeeId)
  }
  return stale.length
}

// ─── Attendance ───────────────────────────────────────────────────────────────

async function upsertAttendanceOnLogin(
  employeeId: string,
  loginAt: Date
): Promise<void> {
  const dateKey = toDateKey(loginAt)

  const cfg = await getAttendanceRules()
  const isLate = isLateArrival(loginAt, cfg)

  // Only the FIRST login of the day sets the arrival time and the late flag.
  //
  // This used to overwrite both on every login, so somebody who arrived at
  // 9:15, lost their laptop to a flat battery and signed back in at 15:00 had
  // their record rewritten to a 15:00 arrival and flipped to LATE_LOGIN. They
  // were on time; the record said otherwise, and nothing could correct it.
  await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId, date: dateKey } },
    create: {
      employeeId,
      date: dateKey,
      status: isLate ? "LATE_LOGIN" : "PRESENT",
      loginAt,
    },
    // Deliberately empty. A record already exists for today, which means they
    // have already arrived — nothing about a second login changes that.
    update: {},
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
