/**
 * "What's overdue" and "what's due this week" — the two questions a manager
 * actually opens the app to answer.
 *
 * Every list filtered by status and nothing else, which slices work by how it
 * is progressing rather than by when it is due. Those are different questions:
 * a task can be IN_PROGRESS and three weeks late, and a status filter will
 * never show you that. Due date is the axis the firm is actually judged on,
 * because the deadline is statutory and does not care what state the row is in.
 *
 * Shared so the same windows mean the same thing on tasks, invoices and
 * deadlines — a manager should not have to learn that "this week" is
 * calendar-week in one list and rolling-seven-days in another.
 *
 * Pure date arithmetic against a caller-supplied `now`, so it is testable and
 * has no hidden dependency on the clock.
 */

export type DueWindow = "OVERDUE" | "TODAY" | "THIS_WEEK" | "NEXT_30" | "NO_DATE"

export const DUE_WINDOW_LABELS: Record<DueWindow, string> = {
  OVERDUE: "Overdue",
  TODAY: "Due today",
  THIS_WEEK: "Due in 7 days",
  NEXT_30: "Due in 30 days",
  NO_DATE: "No due date",
}

export const DUE_WINDOW_OPTIONS: Array<{ value: DueWindow; label: string }> = (
  Object.keys(DUE_WINDOW_LABELS) as DueWindow[]
).map((value) => ({ value, label: DUE_WINDOW_LABELS[value] }))

const startOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const endOfDay = (d: Date): Date => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

const addDays = (d: Date, n: number): Date => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export type DueRange = {
  /** Inclusive lower bound, absent when the window is open-ended below. */
  from?: Date
  /** Inclusive upper bound, absent when the window is open-ended above. */
  to?: Date
  /** True for the window that asks for rows with no due date at all. */
  missing?: boolean
}

/**
 * The date range a window covers.
 *
 * OVERDUE stops at the start of today rather than at `now`: something due at
 * 5pm today is not late at 9am, and calling it late is how a list cries wolf
 * until people stop reading it.
 *
 * The forward windows all start at the beginning of today, so a task due this
 * morning still appears in "due in 7 days" — it is due, and hiding it because
 * the hour has passed would be a strange kind of tidiness.
 */
export function dueWindowRange(window: DueWindow, now: Date): DueRange {
  const today = startOfDay(now)

  switch (window) {
    case "OVERDUE":
      return { to: new Date(today.getTime() - 1) }
    case "TODAY":
      return { from: today, to: endOfDay(now) }
    case "THIS_WEEK":
      return { from: today, to: endOfDay(addDays(now, 7)) }
    case "NEXT_30":
      return { from: today, to: endOfDay(addDays(now, 30)) }
    case "NO_DATE":
      return { missing: true }
  }
}

/** Does this due date fall inside the window? Null dates match only NO_DATE. */
export function matchesDueWindow(
  dueDate: Date | string | null | undefined,
  window: DueWindow,
  now: Date
): boolean {
  const range = dueWindowRange(window, now)
  if (range.missing) return dueDate == null || dueDate === ""
  if (dueDate == null || dueDate === "") return false

  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(d.getTime())) return false

  if (range.from && d < range.from) return false
  if (range.to && d > range.to) return false
  return true
}

/**
 * The same window as a Prisma date filter.
 *
 * Returns null for NO_DATE, because "is null" is not a range and the caller has
 * to express it as `{ dueDate: null }` on the field itself.
 */
export function dueWindowPrismaFilter(
  window: DueWindow,
  now: Date
): { gte?: Date; lte?: Date } | null {
  const range = dueWindowRange(window, now)
  if (range.missing) return null
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  }
}
