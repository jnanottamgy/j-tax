import { redirect } from "next/navigation"

/**
 * The statutory calendar is no longer its own page — it is a filter on
 * /calendar. This keeps every existing link, bookmark and notification href
 * working rather than turning them into 404s.
 *
 * The old page was Partner/Manager only. That restriction is not carried over
 * on purpose: getComplianceEvents already scopes an employee to the clients
 * they are assigned, so what an employee sees here is the statutory deadlines
 * for their own work — which is the thing they are working to.
 */
export default function ComplianceCalendarPage() {
  redirect("/calendar?view=statutory")
}
