import { ComplianceCalendarClient } from "./compliance-calendar-client"

// /calendar is the FIRM calendar (firm-set custom due dates) — visible to all
// staff. Statutory as-per-law dates live on /compliance-calendar (P/M only).
export default function CalendarPage() {
  return <ComplianceCalendarClient variant="firm" />
}
