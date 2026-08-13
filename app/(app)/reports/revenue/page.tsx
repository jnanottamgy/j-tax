import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth/session"
import { getRevenueLedger, type RevenueMetric } from "@/app/actions/revenue"
import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { RevenueLedgerClient } from "./revenue-ledger-client"

/**
 * Revenue ledger — the full-page view behind the dashboard's money tiles.
 * Server-rendered so the first paint already carries the data and the export
 * links are shareable/bookmarkable URLs.
 */
export default async function RevenuePage({
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
  const one = (k: string) => {
    const v = sp[k]
    return typeof v === "string" && v ? v : undefined
  }

  const filters = {
    fy: one("fy"),
    clientId: one("clientId"),
    status: one("status"),
    serviceType: one("serviceType"),
    metric: one("metric") as RevenueMetric | undefined,
  }

  const ledger = await getRevenueLedger(filters)

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb
        items={[{ label: "Reports", href: "/reports" }, { label: "Revenue" }]}
      />
      <RevenueLedgerClient ledger={ledger} filters={filters} />
    </PageContainer>
  )
}
