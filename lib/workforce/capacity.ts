/**
 * Who is over-committed, and when.
 *
 * An Indian practice does not have an even year. September carries the tax
 * audit deadline, March carries year-end and the last date for belated returns,
 * and both arrive with a month of work compressed into a fortnight. The app
 * could say how many tasks someone held and never how many working days they
 * had left to do them in — which is the only form of the question that has an
 * answer.
 *
 * Leave is the missing half. Twenty tasks and twenty working days is a busy
 * month; twenty tasks and eight working days, because someone is away for a
 * fortnight, is a deadline that will be missed — and until leave was recorded
 * anywhere, the two looked identical.
 *
 * Pure: the caller supplies the tasks, the leave and the window.
 */

export type LeavePeriod = { startDate: Date; endDate: Date }

/** Saturday and Sunday. Firms that work Saturdays can pass their own predicate. */
const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6

const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Every day covered by a leave period, inclusive of both ends. */
export function leaveDays(periods: LeavePeriod[]): Set<string> {
  const days = new Set<string>()
  for (const p of periods) {
    const cursor = new Date(p.startDate)
    cursor.setHours(0, 0, 0, 0)
    const end = new Date(p.endDate)
    end.setHours(0, 0, 0, 0)
    // Guard against an inverted or absurd range rather than looping for ever.
    let guard = 0
    while (cursor <= end && guard < 400) {
      days.add(dayKey(cursor))
      cursor.setDate(cursor.getDate() + 1)
      guard++
    }
  }
  return days
}

/**
 * Working days left in a window: weekdays, minus the ones this person is away.
 *
 * Counts from `from` inclusive, so "today" is a working day if it is a weekday
 * — a deadline five days out with three of them weekend is the case this
 * exists to make visible.
 */
export function workingDaysAvailable(
  from: Date,
  to: Date,
  leave: LeavePeriod[]
): number {
  const away = leaveDays(leave)
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)

  let count = 0
  let guard = 0
  while (cursor <= end && guard < 400) {
    if (!isWeekend(cursor) && !away.has(dayKey(cursor))) count++
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return count
}

/** Is this person away on a given day? */
export function isOnLeave(date: Date, leave: LeavePeriod[]): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return leave.some((p) => {
    const s = new Date(p.startDate)
    s.setHours(0, 0, 0, 0)
    const e = new Date(p.endDate)
    e.setHours(23, 59, 59, 999)
    return d >= s && d <= e
  })
}

export type CapacityLoad = "CLEAR" | "BUSY" | "TIGHT" | "OVER"

export type CapacityAssessment = {
  employeeId: string
  employeeName: string
  /** Open tasks due inside the window. */
  dueInWindow: number
  /** Tasks already past their due date — they consume today, not the window. */
  overdue: number
  /** Weekdays in the window this person is actually available. */
  workingDays: number
  /** Days of leave inside the window. */
  leaveDays: number
  /** Tasks per available day. Infinity when there are no days left at all. */
  tasksPerDay: number
  load: CapacityLoad
  /** One line naming the problem, or null when there isn't one. */
  warning: string | null
}

/**
 * Thresholds.
 *
 * A filing task is not an hour's work — between chasing the client, preparing
 * and reviewing, two a day is a full day for most people. These are deliberately
 * blunt: the point is to sort a team into "fine", "watch" and "this will not
 * happen", not to pretend an estimate exists that nobody entered.
 */
const BUSY_PER_DAY = 1.5
const TIGHT_PER_DAY = 2.5
const OVER_PER_DAY = 4

export function assessCapacity(input: {
  employeeId: string
  employeeName: string
  /** Open tasks with a due date inside the window. */
  dueInWindow: number
  /** Open tasks already overdue. */
  overdue: number
  windowFrom: Date
  windowTo: Date
  leave: LeavePeriod[]
}): CapacityAssessment {
  const workingDays = workingDaysAvailable(input.windowFrom, input.windowTo, input.leave)
  const away = leaveDays(input.leave)
  // Only leave falling inside the window counts towards the report.
  let leaveInWindow = 0
  {
    const cursor = new Date(input.windowFrom)
    cursor.setHours(0, 0, 0, 0)
    const end = new Date(input.windowTo)
    end.setHours(0, 0, 0, 0)
    let guard = 0
    while (cursor <= end && guard < 400) {
      if (!isWeekend(cursor) && away.has(dayKey(cursor))) leaveInWindow++
      cursor.setDate(cursor.getDate() + 1)
      guard++
    }
  }

  // Overdue work has to come out of the same days, so it counts against them.
  const total = input.dueInWindow + input.overdue
  const tasksPerDay = workingDays > 0 ? total / workingDays : total > 0 ? Infinity : 0

  const load: CapacityLoad =
    total === 0
      ? "CLEAR"
      : tasksPerDay >= OVER_PER_DAY
        ? "OVER"
        : tasksPerDay >= TIGHT_PER_DAY
          ? "TIGHT"
          : tasksPerDay >= BUSY_PER_DAY
            ? "BUSY"
            : "CLEAR"

  let warning: string | null = null
  if (workingDays === 0 && total > 0) {
    warning = `${total} open ${total === 1 ? "task" : "tasks"} and no working days available — on leave for the whole period.`
  } else if (load === "OVER") {
    warning = `${total} tasks across ${workingDays} working ${workingDays === 1 ? "day" : "days"} — around ${tasksPerDay.toFixed(1)} a day. This will not hold.`
  } else if (load === "TIGHT") {
    warning = `${total} tasks across ${workingDays} working ${workingDays === 1 ? "day" : "days"}${leaveInWindow > 0 ? `, with ${leaveInWindow} ${leaveInWindow === 1 ? "day" : "days"} of leave` : ""}.`
  } else if (input.overdue > 0) {
    warning = `${input.overdue} already overdue.`
  }

  return {
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    dueInWindow: input.dueInWindow,
    overdue: input.overdue,
    workingDays,
    leaveDays: leaveInWindow,
    tasksPerDay: Number.isFinite(tasksPerDay) ? Math.round(tasksPerDay * 10) / 10 : Infinity,
    load,
    warning,
  }
}

/**
 * The two months an Indian practice actually plans around.
 *
 * September: tax audit and the audited-return deadline. March: year-end, the
 * last date for belated and revised returns, and advance tax.
 */
export function peakWindows(year: number): Array<{ label: string; from: Date; to: Date }> {
  return [
    { label: `September ${year}`, from: new Date(year, 8, 1), to: new Date(year, 8, 30, 23, 59, 59) },
    { label: `March ${year + 1}`, from: new Date(year + 1, 2, 1), to: new Date(year + 1, 2, 31, 23, 59, 59) },
  ]
}
