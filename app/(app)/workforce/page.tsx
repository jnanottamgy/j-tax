import { redirect } from "next/navigation"
import { requirePartner } from "@/lib/auth/guards"
import { getWorkforceDashboard, getPerformanceMetrics, getWorkloadAlerts, getTeamComparisonData } from "@/app/actions/workforce"
import { WorkforceDashboardClient } from "@/components/workforce/workforce-dashboard-client"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"

export const metadata = { title: "Workforce Intelligence" }

export default async function WorkforcePage() {
  try {
    await requirePartner()
  } catch {
    redirect("/unauthorized")
  }

  const [dashboard, performance, alerts, comparison] = await Promise.all([
    getWorkforceDashboard(),
    getPerformanceMetrics("month"),
    getWorkloadAlerts(),
    getTeamComparisonData("month"),
  ])

  return (
    <PageContainer>
      <PageHeader
        title="Workforce Intelligence"
        description="Real-time visibility into employee activity, performance, and attendance"
      />
      <WorkforceDashboardClient
        initialDashboard={dashboard}
        initialPerformance={performance}
        initialAlerts={alerts}
        initialComparison={comparison}
      />
    </PageContainer>
  )
}
