import { notFound, redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { getInsight } from "@/app/actions/dashboard-insights"
import { INSIGHT_METRICS, type InsightMetric } from "@/lib/dashboard/insight-metrics"
import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { InsightDetailClient } from "./insight-detail-client"

const VALID = INSIGHT_METRICS

/**
 * Drill-down behind a Command Center tile. The metric is in the URL so the view
 * is shareable and the export can reproduce exactly what was on screen.
 */
export default async function InsightPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.user.role !== "PARTNER" && session.user.role !== "MANAGER") {
    redirect("/unauthorized")
  }

  const sp = await searchParams
  const raw = typeof sp.metric === "string" ? sp.metric : ""
  if (!VALID.includes(raw as InsightMetric)) notFound()

  const insight = await getInsight(raw as InsightMetric)

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb
        items={[{ label: "Dashboard", href: "/" }, { label: insight.title }]}
      />
      <InsightDetailClient insight={insight} />
    </PageContainer>
  )
}
