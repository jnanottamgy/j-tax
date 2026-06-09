import { ComplianceOverview } from "@/components/dashboard/compliance-overview"
import { ExecutiveSummary } from "@/components/dashboard/executive-summary"
import { FilingChart } from "@/components/dashboard/filing-chart"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { OutstandingPayments } from "@/components/dashboard/outstanding-payments"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { TasksDueToday } from "@/components/dashboard/tasks-due-today"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  // Scope queries for EXECUTIVE to their assigned clients only
  const isExecutive = session.user.role === "EXECUTIVE"
  const assignedEmployee = isExecutive
    ? await prisma.employee.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
    : null
  const clientFilter = isExecutive && assignedEmployee
    ? { assignedEmployeeId: assignedEmployee.id }
    : {}

  const [
    totalClients,
    activeClients,
    invoiceAgg,
    overdueInvoiceAgg,
    pendingComplianceCount,
    completedComplianceCount,
    tasksDueTodayRaw,
    recentActivityRaw,
    outstandingInvoicesRaw,
    complianceEventsRaw,
    taskStatusCounts,
    overdueTasksCount,
    upcomingDeadlinesCount,
  ] = await Promise.all([
    prisma.client.count({ where: clientFilter }),
    prisma.client.count({ where: { ...clientFilter, status: "ACTIVE" } }),
    prisma.invoice.aggregate({
      where: { client: clientFilter },
      _sum: { amount: true, paidAmount: true, outstandingAmount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { client: clientFilter, status: "OVERDUE" },
      _sum: { outstandingAmount: true },
      _count: true,
    }),
    prisma.complianceEvent.count({
      where: { client: Object.keys(clientFilter).length ? clientFilter : undefined, status: "PENDING" },
    }),
    prisma.complianceEvent.count({
      where: { client: Object.keys(clientFilter).length ? clientFilter : undefined, status: "COMPLETED" },
    }),
    // Tasks due today
    prisma.task.findMany({
      where: {
        client: clientFilter,
        dueDate: { gte: todayStart, lt: todayEnd },
        status: { not: "FILED_DONE" },
      },
      include: { client: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 5,
    }),
    // Recent activity logs
    prisma.activityLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 6,
    }),
    // Outstanding invoices for the payments widget
    prisma.invoice.findMany({
      where: {
        client: clientFilter,
        status: { in: ["OVERDUE", "SENT", "PARTIALLY_PAID"] },
        outstandingAmount: { gt: 0 },
      },
      include: { client: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 4,
    }),
    // Compliance events for overview
    prisma.complianceEvent.findMany({
      where: {
        client: Object.keys(clientFilter).length ? clientFilter : undefined,
        dueDate: { gte: now },
        status: { in: ["PENDING", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    // Task status breakdown for filing chart
    prisma.task.groupBy({
      by: ["status"],
      where: { client: clientFilter },
      _count: true,
    }),
    // Overdue tasks count
    prisma.task.count({
      where: {
        client: clientFilter,
        dueDate: { lt: todayStart },
        status: { not: "FILED_DONE" },
      },
    }),
    // Upcoming deadlines this week
    prisma.complianceEvent.count({
      where: {
        client: Object.keys(clientFilter).length ? clientFilter : undefined,
        dueDate: { gte: now, lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        status: { in: ["PENDING", "OVERDUE"] },
      },
    }),
  ])

  const totalOutstanding = Number(invoiceAgg._sum.outstandingAmount ?? 0)
  const totalCollected = Number(invoiceAgg._sum.paidAmount ?? 0)
  const totalOverdue = Number(overdueInvoiceAgg._sum.outstandingAmount ?? 0)
  const totalCompliance = pendingComplianceCount + completedComplianceCount
  const complianceScore = totalCompliance > 0
    ? Math.round((completedComplianceCount / totalCompliance) * 100)
    : 100

  // Serialize Decimal objects to numbers for client components
  const serializedOutstandingInvoices = outstandingInvoicesRaw.map(invoice => ({
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
  }))

  // Calculate workload (simplified: tasks per active client)
  const totalTasks = await prisma.task.count({ where: clientFilter })
  const workload = activeClients > 0 ? Math.round((totalTasks / activeClients) * 10) : 0

  const kpiData = {
    totalClients,
    activeClients,
    totalOutstanding,
    totalCollected,
    totalOverdue,
    overdueCount: overdueInvoiceAgg._count,
    complianceScore,
    pendingComplianceCount,
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Dashboard" }]} />
      <PageHeader
        label={`Welcome back, ${session.user.name}`}
        title="Tax Operations Dashboard"
        description="Monitor filings, compliance, and payments across your client portfolio in real time."
      />

      <ExecutiveSummary
        overdueTasks={overdueTasksCount}
        upcomingDeadlines={upcomingDeadlinesCount}
        outstandingInvoices={overdueInvoiceAgg._count}
        pendingDocuments={0} // TODO: Add document count
        complianceScore={complianceScore}
        workload={Math.min(workload, 100)}
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <KpiCards data={kpiData} />
        </div>
        <QuickActions />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <RevenueChart collected={totalCollected} outstanding={totalOutstanding} />
        <FilingChart taskStatusCounts={taskStatusCounts} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivity logs={recentActivityRaw} />
        </div>
        <TasksDueToday tasks={tasksDueTodayRaw} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ComplianceOverview events={complianceEventsRaw} total={totalCompliance} completed={completedComplianceCount} />
        <OutstandingPayments invoices={serializedOutstandingInvoices} />
      </div>
    </PageContainer>
  )
}
