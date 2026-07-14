import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { ComplianceCalendarClient } from "../calendar/compliance-calendar-client"

// Statutory, as-per-law compliance calendar — management only.
export default async function ComplianceCalendarPage() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.user.role !== "PARTNER" && session.user.role !== "MANAGER") {
    redirect("/unauthorized")
  }
  return <ComplianceCalendarClient variant="compliance" />
}
