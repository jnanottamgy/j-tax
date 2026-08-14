import { ComplianceCalendarClient } from "./compliance-calendar-client"

/**
 * The firm's one calendar.
 *
 * Statutory dates and firm-set dates used to be two routes and two nav entries
 * over one table split by a boolean. Nobody plans a month in two calendars —
 * a GST deadline and the internal review a manager set three days before it are
 * the same week's work.
 *
 * `?view=statutory|firm` keeps the old deep links landing somewhere sensible.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const initialSource = view === "statutory" || view === "firm" ? view : "all"
  return <ComplianceCalendarClient initialSource={initialSource} />
}
