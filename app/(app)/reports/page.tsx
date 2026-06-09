import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"

import { ReportingCenterClient } from "./reporting-center-client"

export default async function ReportsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  return <ReportingCenterClient />
}

