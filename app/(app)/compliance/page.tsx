import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth/session"
import { getComplianceDashboard } from "@/app/actions/compliance"
import { ComplianceDashboardClient } from "./compliance-dashboard-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"

export default async function CompliancePage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const data = await getComplianceDashboard()

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Compliance" }]} />
      <PageHeader
        label="Compliance management"
        title="Compliance Operations"
        description="Monitor filings, deadlines, and compliance health across all clients."
      />
      <ComplianceDashboardClient data={data} />
    </PageContainer>
  )
}
