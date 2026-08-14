import { prisma } from "@/lib/prisma"

/**
 * When the working day starts, and who is late.
 *
 * This was a single constant — 09:30 IST, no grace, no notion of which days a
 * firm works. A practice starting at 10:00 had its whole team marked late every
 * morning, and because Saturday is an ordinary working day for most Indian
 * firms, weekend logins were judged by the same rule with no way to change it.
 *
 * The arithmetic is pure and exported separately from the lookup, so it can be
 * tested without a database.
 */

export type AttendanceRules = {
  /** Local start of the working day, minutes past midnight. */
  startMinutes: number
  graceMinutes: number
  /** 1 = Monday … 7 = Sunday. */
  workingWeekdays: number[]
  /** Minutes offset from UTC for the firm's local time. 330 = IST. */
  timezoneOffsetMinutes: number
}

export const DEFAULT_RULES: AttendanceRules = {
  startMinutes: 9 * 60 + 30,
  graceMinutes: 15,
  // Six-day weeks are the norm in Indian practice, so Saturday is a working
  // day unless a firm says otherwise.
  workingWeekdays: [1, 2, 3, 4, 5, 6],
  timezoneOffsetMinutes: 330,
}

/** "09:30" → 570. Falls back rather than throwing on a malformed setting. */
export function parseClockTime(value: string | null | undefined, fallback: number): number {
  const m = (value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return fallback
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return fallback
  return h * 60 + min
}

/** The firm's local wall-clock time for an instant, as minutes past midnight. */
export function localMinutesOfDay(at: Date, offsetMinutes: number): number {
  const utcMinutes = at.getUTCHours() * 60 + at.getUTCMinutes()
  return ((utcMinutes + offsetMinutes) % 1440 + 1440) % 1440
}

/** ISO weekday in the firm's local time: 1 = Monday … 7 = Sunday. */
export function localWeekday(at: Date, offsetMinutes: number): number {
  const shifted = new Date(at.getTime() + offsetMinutes * 60_000)
  const day = shifted.getUTCDay() // 0 = Sunday
  return day === 0 ? 7 : day
}

/** Is this a day the firm works at all? */
export function isWorkingDay(at: Date, rules: AttendanceRules): boolean {
  return rules.workingWeekdays.includes(localWeekday(at, rules.timezoneOffsetMinutes))
}

/**
 * Late, in the firm's own terms.
 *
 * Never late on a day the firm does not work — somebody who comes in on a
 * Sunday is doing the firm a favour, and marking them late for it is the kind
 * of detail that makes people stop trusting the whole report.
 */
export function isLateArrival(at: Date, rules: AttendanceRules): boolean {
  if (!isWorkingDay(at, rules)) return false
  const arrival = localMinutesOfDay(at, rules.timezoneOffsetMinutes)
  return arrival > rules.startMinutes + rules.graceMinutes
}

/** The firm's rules, falling back to the defaults when unset. */
export async function getAttendanceRules(): Promise<AttendanceRules> {
  try {
    const settings = await prisma.firmSettings.findFirst({
      select: {
        workDayStart: true,
        lateGraceMinutes: true,
        workingWeekdays: true,
        timezoneOffsetMinutes: true,
      },
    })
    if (!settings) return DEFAULT_RULES

    return {
      startMinutes: parseClockTime(settings.workDayStart, DEFAULT_RULES.startMinutes),
      graceMinutes: settings.lateGraceMinutes ?? DEFAULT_RULES.graceMinutes,
      workingWeekdays:
        settings.workingWeekdays?.length > 0
          ? settings.workingWeekdays
          : DEFAULT_RULES.workingWeekdays,
      timezoneOffsetMinutes:
        settings.timezoneOffsetMinutes ?? DEFAULT_RULES.timezoneOffsetMinutes,
    }
  } catch {
    // Attendance must never fail a login. Defaults are better than an error.
    return DEFAULT_RULES
  }
}
