import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { getComplianceDashboard } from "@/app/actions/compliance"
import { ComplianceDashboardClient } from "./compliance-dashboard-client"
import { CoverageGapBanner } from "@/components/compliance/coverage-gap-banner"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"

export default async function CompliancePage() {
  const session = await getSession()
  if (!session) redirect("/login")
  // Compliance Operations is a management view — employees are routed away
  // (defense-in-depth; the route ACL + middleware already block them).
  if (session.user.role !== "PARTNER" && session.user.role !== "MANAGER") {
    redirect("/unauthorized")
  }

  const data = await getComplianceDashboard()

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Compliance" }]} />
      <PageHeader
        label="Compliance management"
        title="Compliance Operations"
        description="Monitor filings, deadlines, and compliance health across all clients."
      />
      {/* Silent-exclusion warning. Renders nothing when every client with
          active services is actually in the engine. */}
      <CoverageGapBanner />
      <ComplianceDashboardClient data={data} />
    </PageContainer>
  )
}
