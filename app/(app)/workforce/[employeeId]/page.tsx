import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { requirePartner } from "@/lib/auth/guards"
import { getEmployeeDetail, getEmployeeTimeline, getProductivityChartData } from "@/app/actions/workforce"
import { EmployeeDetailClient } from "@/components/workforce/employee-detail-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"

export const metadata = { title: "Employee Detail" }

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>
}) {
  try {
    await requirePartner()
  } catch {
    redirect("/unauthorized")
  }

  const { employeeId } = await params

  const [detail, timeline, chartData] = await Promise.all([
    getEmployeeDetail(employeeId),
    getEmployeeTimeline(employeeId, "today"),
    getProductivityChartData(employeeId, "week"),
  ])

  if (!detail) notFound()

  const backLink = (
    <Link href="/workforce" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ChevronLeft className="size-4" />
      Workforce
    </Link>
  )

  return (
    <PageContainer>
      <PageHeader
        title={detail.employee.name}
        description={`${detail.employee.department ?? "No department"} · ${detail.employee.email}`}
        action={backLink}
      />
      <EmployeeDetailClient
        detail={detail}
        initialTimeline={timeline}
        initialChartData={chartData}
      />
    </PageContainer>
  )
}
