import { redirect } from "next/navigation"
import { requirePartnerOrManager } from "@/lib/auth/guards"
import { getWorkforceDashboard, getPerformanceMetrics, getWorkloadAlerts, getTeamComparisonData } from "@/app/actions/workforce"
import { WorkforceDashboardClient } from "@/components/workforce/workforce-dashboard-client"
import { CapacityPanel } from "@/components/workforce/capacity-panel"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"

export const metadata = { title: "Workforce Intelligence" }

export default async function WorkforcePage() {
  try {
    await requirePartnerOrManager()
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
      {/* Head-count and activity were already here; what was missing was
          whether the work fits in the days available. */}
      <div className="mb-6">
        <CapacityPanel />
      </div>
      <WorkforceDashboardClient
        initialDashboard={dashboard}
        initialPerformance={performance}
        initialAlerts={alerts}
        initialComparison={comparison}
      />
    </PageContainer>
  )
}
