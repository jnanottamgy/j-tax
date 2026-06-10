import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"

// Dashboard components
import { ComplianceOverview } from "@/components/dashboard/compliance-overview"
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard"
import { ExecutiveSummary } from "@/components/dashboard/executive-summary"
import { FilingChart } from "@/components/dashboard/filing-chart"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard"
import { OutstandingPayments } from "@/components/dashboard/outstanding-payments"
import { PartnerCommandCenter } from "@/components/dashboard/partner-command-center"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { SetupChecklist } from "@/components/dashboard/setup-checklist"
import { TasksDueToday } from "@/components/dashboard/tasks-due-today"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"

// ─── PARTNER / full-firm dashboard fetcher ────────────────────────────────────

function makePartnerDashboardFetcher(userId: string) {
  const todayKey = new Date().toISOString().slice(0, 10)
  return unstable_cache(
    async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      const _weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

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
        totalTasks,
        checklistEmployeeCount,
        checklistClientCount,
        checklistTaskCount,
        checklistDocCount,
        checklistInvoiceCount,
        checklistComplianceCount,
        pendingApprovals,
        highRiskClients,
        activeEmployeeCount,
      ] = await Promise.all([
        prisma.client.count(),
        prisma.client.count({ where: { status: "ACTIVE" } }),
        prisma.invoice.aggregate({
          _sum: { amount: true, paidAmount: true, outstandingAmount: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { status: "OVERDUE" },
          _sum: { outstandingAmount: true },
          _count: true,
        }),
        prisma.complianceEvent.count({ where: { status: "PENDING" } }),
        prisma.complianceEvent.count({ where: { status: "COMPLETED" } }),
        prisma.task.findMany({
          where: { dueDate: { gte: todayStart, lt: todayEnd }, status: { not: "FILED_DONE" } },
          include: { client: true },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          take: 5,
        }),
        prisma.activityLog.findMany({ orderBy: { timestamp: "desc" }, take: 6 }),
        prisma.invoice.findMany({
          where: { status: { in: ["OVERDUE", "SENT", "PARTIALLY_PAID"] }, outstandingAmount: { gt: 0 } },
          include: { client: { select: { name: true } } },
          orderBy: [{ status: "asc" }, { dueDate: "asc" }],
          take: 4,
        }),
        prisma.complianceEvent.findMany({
          where: { dueDate: { gte: now }, status: { in: ["PENDING", "OVERDUE"] } },
          orderBy: { dueDate: "asc" },
          take: 5,
        }),
        prisma.task.groupBy({ by: ["status"], _count: true }),
        prisma.task.count({ where: { dueDate: { lt: todayStart }, status: { not: "FILED_DONE" } } }),
        prisma.complianceEvent.count({
          where: { dueDate: { gte: now, lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }, status: { in: ["PENDING", "OVERDUE"] } },
        }),
        prisma.task.count(),
        prisma.employee.count(),
        prisma.client.count(),
        prisma.task.count(),
        prisma.document.count(),
        prisma.invoice.count(),
        prisma.complianceEvent.count(),
        // Pending quotation approvals
        prisma.quotation.count({ where: { status: "PENDING_APPROVAL" } }),
        // High risk: clients with ≥3 overdue tasks
        prisma.client.findMany({
          where: {
            tasks: {
              some: { dueDate: { lt: now }, status: { not: "FILED_DONE" } },
            },
          },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                tasks: { where: { dueDate: { lt: now }, status: { not: "FILED_DONE" } } },
              },
            },
          },
          orderBy: { name: "asc" },
          take: 5,
        }),
        prisma.employee.count({ where: { isActive: true } }),
      ])

      const serializedOutstandingInvoices = outstandingInvoicesRaw.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
        paidAmount: Number(inv.paidAmount),
        outstandingAmount: Number(inv.outstandingAmount),
      }))

      const totalRevenue = Number(invoiceAgg._sum.amount ?? 0)
      const totalCollected = Number(invoiceAgg._sum.paidAmount ?? 0)
      const totalOutstanding = Number(invoiceAgg._sum.outstandingAmount ?? 0)
      const totalOverdue = Number(overdueInvoiceAgg._sum.outstandingAmount ?? 0)
      const collectionRate =
        totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0

      // Pending approvals for command center
      const pendingApprovalsList = await prisma.quotation.findMany({
        where: { status: "PENDING_APPROVAL" },
        select: { id: true, clientName: true, total: true, quotationNumber: true },
        take: 3,
      })

      return {
        totalClients,
        activeClients,
        totalOutstanding,
        totalCollected,
        totalRevenue,
        totalOverdue,
        overdueCount: overdueInvoiceAgg._count,
        pendingComplianceCount,
        completedComplianceCount,
        tasksDueTodayRaw,
        recentActivityRaw,
        serializedOutstandingInvoices,
        complianceEventsRaw,
        taskStatusCounts,
        overdueTasksCount,
        upcomingDeadlinesCount,
        totalTasks,
        totalDocuments: checklistDocCount,
        collectionRate,
        setupChecklist: {
          hasEmployees: checklistEmployeeCount > 0,
          hasClients: checklistClientCount > 0,
          hasTasks: checklistTaskCount > 0,
          hasDocuments: checklistDocCount > 0,
          hasInvoices: checklistInvoiceCount > 0,
          hasCompliance: checklistComplianceCount > 0,
        },
        commandCenter: {
          totalRevenue,
          totalOutstanding,
          totalOverdue,
          collectionRate,
          pendingApprovals,
          activeEmployees: activeEmployeeCount,
          highRiskClients: highRiskClients.filter((c) => c._count.tasks >= 2).length,
          complianceScore: 0, // filled below
        },
        pendingApprovalsList: pendingApprovalsList.map((q) => ({
          id: q.id,
          clientName: q.clientName,
          amount: Number(q.total),
          type: q.quotationNumber,
        })),
        highRiskClientsList: highRiskClients
          .filter((c) => c._count.tasks >= 2)
          .map((c) => ({
            id: c.id,
            name: c.name,
            riskReason: `${c._count.tasks} overdue`,
          })),
      }
    },
    [`dashboard-partner-${userId}-${todayKey}`],
    { revalidate: 60, tags: ["dashboard", `dashboard-${userId}`] }
  )
}

// ─── MANAGER dashboard fetcher ────────────────────────────────────────────────

function makeManagerDashboardFetcher(userId: string) {
  const todayKey = new Date().toISOString().slice(0, 10)
  return unstable_cache(
    async () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const [employees, invoiceAgg, pendingCompliance] = await Promise.all([
        prisma.employee.findMany({
          where: { isActive: true },
          select: { id: true, name: true, department: true },
          orderBy: { name: "asc" },
          take: 20,
        }),
        prisma.invoice.aggregate({
          _sum: { amount: true, paidAmount: true, outstandingAmount: true },
        }),
        prisma.complianceEvent.count({ where: { status: "PENDING" } }),
      ])

      const employeeIds = employees.map((e) => e.id)

      const [tasksByEmployee, overdueByEmployee, completedThisWeek] =
        await Promise.all([
          prisma.task.groupBy({
            by: ["assignedEmployeeId"],
            where: { assignedEmployeeId: { in: employeeIds }, status: { not: "FILED_DONE" } },
            _count: { _all: true },
          }),
          prisma.task.groupBy({
            by: ["assignedEmployeeId"],
            where: {
              assignedEmployeeId: { in: employeeIds },
              dueDate: { lt: now },
              status: { not: "FILED_DONE" },
            },
            _count: { _all: true },
          }),
          prisma.task.count({
            where: { status: "FILED_DONE", updatedAt: { gte: weekAgo } },
          }),

        ])

      const totalByEmployee = await prisma.task.groupBy({
        by: ["assignedEmployeeId"],
        where: { assignedEmployeeId: { in: employeeIds } },
        _count: { _all: true },
      })

      const activeMap = new Map(tasksByEmployee.map((r) => [r.assignedEmployeeId, r._count._all]))
      const overdueMap = new Map(overdueByEmployee.map((r) => [r.assignedEmployeeId, r._count._all]))
      const totalMap = new Map(totalByEmployee.map((r) => [r.assignedEmployeeId, r._count._all]))

      const teamWorkload = employees.map((e) => {
        const active = activeMap.get(e.id) ?? 0
        const overdue = overdueMap.get(e.id) ?? 0
        const total = totalMap.get(e.id) ?? 0
        const completed = total - active
        const productivity = total > 0 ? Math.round((completed / total) * 100) : 0
        return {
          employee: { id: e.id, name: e.name, department: e.department },
          totalTasks: total,
          completedTasks: completed,
          overdueTasks: overdue,
          productivity,
        }
      })

      const totalActiveTasks = Array.from(activeMap.values()).reduce((s, v) => s + v, 0)
      const overdueTotal = Array.from(overdueMap.values()).reduce((s, v) => s + v, 0)

      // Urgent: overdue tasks & compliance
      const [overdueTasksList, overdueComplianceList] = await Promise.all([
        prisma.task.findMany({
          where: { dueDate: { lt: now }, status: { not: "FILED_DONE" } },
          include: { client: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 6,
        }),
        prisma.complianceEvent.findMany({
          where: { status: "OVERDUE" },
          include: { client: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 4,
        }),
      ])

      const urgentItems = [
        ...overdueTasksList.map((t) => ({
          type: "TASK" as const,
          title: t.title,
          clientName: t.client?.name ?? "—",
          dueDate: t.dueDate?.toISOString() ?? null,
          priority: t.priority,
        })),
        ...overdueComplianceList.map((c) => ({
          type: "COMPLIANCE" as const,
          title: c.title,
          clientName: c.client?.name ?? "—",
          dueDate: c.dueDate?.toISOString() ?? null,
        })),
      ].slice(0, 8)

      const totalRevenue = Number(invoiceAgg._sum.amount ?? 0)
      const totalCollected = Number(invoiceAgg._sum.paidAmount ?? 0)
      const collectionRate =
        totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0

      const totalClients = await prisma.client.count()

      return {
        teamStats: {
          totalEmployees: employees.length,
          totalActiveTasks,
          completedThisWeek,
          overdueTotal,
          totalClients,
          pendingCompliance,
          collectionRate,
          totalOutstanding: Number(invoiceAgg._sum.outstandingAmount ?? 0),
        },
        teamWorkload,
        urgentItems,
        recentActivity: [] as Array<{id: string; action: string; description: string; timestamp: string; entityType: string}>,
      }
    },
    [`dashboard-manager-${userId}-${todayKey}`],
    { revalidate: 60, tags: ["dashboard", `dashboard-${userId}`] }
  )
}

// ─── EMPLOYEE personal dashboard fetcher ─────────────────────────────────────

function makeEmployeeDashboardFetcher(userId: string) {
  const todayKey = new Date().toISOString().slice(0, 10)
  return unstable_cache(
    async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

      // Find the employee record linked to this user
      const myEmployee = await prisma.employee.findUnique({
        where: { userId },
        select: { id: true, name: true },
      })

      if (!myEmployee) {
        return {
          myEmployee: null,
          stats: { totalTasks: 0, completedTasks: 0, overdueTasks: 0, tasksDueToday: 0, totalClients: 0, activeClients: 0, pendingCompliance: 0 },
          todayTasks: [],
          myTasks: [],
          myClients: [],
          upcomingCompliance: [],
        }
      }

      const empId = myEmployee.id

      const [
        myTasksRaw,
        myClientsRaw,
        todayTasksRaw,
        completedTasks,
        overdueTasks,
        upcomingComplianceRaw,
        pendingCompliance,
      ] = await Promise.all([
        prisma.task.findMany({
          where: { assignedEmployeeId: empId, status: { not: "FILED_DONE" } },
          include: { client: { select: { name: true } } },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
          take: 20,
        }),
        prisma.client.findMany({
          where: { assignedEmployeeId: empId },
          select: { id: true, name: true, clientCode: true, status: true },
          orderBy: { name: "asc" },
          take: 20,
        }),
        prisma.task.findMany({
          where: { assignedEmployeeId: empId, dueDate: { gte: todayStart, lt: todayEnd }, status: { not: "FILED_DONE" } },
          include: { client: { select: { name: true } } },
          orderBy: [{ priority: "desc" }],
          take: 10,
        }),
        prisma.task.count({ where: { assignedEmployeeId: empId, status: "FILED_DONE" } }),
        prisma.task.count({ where: { assignedEmployeeId: empId, dueDate: { lt: now }, status: { not: "FILED_DONE" } } }),
        prisma.complianceEvent.findMany({
          where: {
            client: { assignedEmployeeId: empId },
            dueDate: { gte: now },
            status: { not: "COMPLETED" },
          },
          include: { client: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
          take: 10,
        }),
        prisma.complianceEvent.count({
          where: { client: { assignedEmployeeId: empId }, status: "PENDING" },
        }),
      ])

      const totalTasks = myTasksRaw.length + completedTasks
      const activeClients = myClientsRaw.filter((c) => c.status === "ACTIVE").length

      return {
        myEmployee: { id: myEmployee.id, name: myEmployee.name },
        stats: {
          totalTasks,
          completedTasks,
          overdueTasks,
          tasksDueToday: todayTasksRaw.length,
          totalClients: myClientsRaw.length,
          activeClients,
          pendingCompliance,
        },
        todayTasks: todayTasksRaw.map((t) => ({
          ...t,
          dueDate: t.dueDate?.toISOString() ?? null,
          client: t.client,
        })),
        myTasks: myTasksRaw.map((t) => ({
          ...t,
          dueDate: t.dueDate?.toISOString() ?? null,
          client: t.client,
        })),
        myClients: myClientsRaw,
        upcomingCompliance: upcomingComplianceRaw.map((e) => ({
          ...e,
          dueDate: e.dueDate.toISOString(),
          client: e.client,
        })),
      }
    },
    [`dashboard-employee-${userId}-${todayKey}`],
    { revalidate: 60, tags: ["dashboard", `dashboard-${userId}`] }
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const { user } = session
  const role = user.role

  // ─── EMPLOYEE dashboard ───────────────────────────────────────────────────
  if (role === "EMPLOYEE") {
    const fetcher = makeEmployeeDashboardFetcher(user.id)
    const data = await fetcher()

    return (
      <PageContainer className="space-y-6">
        <Breadcrumb items={[{ label: "Dashboard" }]} />
        <PageHeader
          label={`Welcome back, ${user.name}`}
          title="My Work Dashboard"
          description="Your tasks, clients, compliance queue, and personal performance."
        />
        <EmployeeDashboard
          employeeName={user.name}
          stats={data.stats}
          todayTasks={data.todayTasks}
          myTasks={data.myTasks}
          myClients={data.myClients}
          upcomingCompliance={data.upcomingCompliance}
        />
      </PageContainer>
    )
  }

  // ─── MANAGER dashboard ────────────────────────────────────────────────────
  if (role === "MANAGER") {
    const fetcher = makeManagerDashboardFetcher(user.id)
    const data = await fetcher()

    return (
      <PageContainer className="space-y-6">
        <Breadcrumb items={[{ label: "Dashboard" }]} />
        <PageHeader
          label={`Welcome back, ${user.name}`}
          title="Team Operations Dashboard"
          description="Team workload, compliance status, SLA tracking, and urgent items."
        />
        <SetupChecklist
          data={{
            hasEmployees: data.teamStats.totalEmployees > 0,
            hasClients: data.teamStats.totalClients > 0,
            hasTasks: data.teamStats.totalActiveTasks > 0,
            hasDocuments: true,
            hasInvoices: true,
            hasCompliance: data.teamStats.pendingCompliance > 0,
          }}
        />
        <ManagerDashboard
          managerName={user.name}
          teamStats={data.teamStats}
          teamWorkload={data.teamWorkload}
          urgentItems={data.urgentItems}
          recentActivity={data.recentActivity}
        />
      </PageContainer>
    )
  }

  // ─── PARTNER dashboard (default / full firm view) ─────────────────────────
  const fetcher = makePartnerDashboardFetcher(user.id)
  const data = await fetcher()

  const {
    totalClients,
    activeClients,
    totalOutstanding,
    totalCollected,
    totalRevenue: _totalRevenue,
    totalOverdue,
    overdueCount,
    pendingComplianceCount,
    completedComplianceCount,
    tasksDueTodayRaw,
    recentActivityRaw,
    serializedOutstandingInvoices,
    complianceEventsRaw,
    taskStatusCounts,
    overdueTasksCount,
    upcomingDeadlinesCount,
    totalTasks,
    totalDocuments,
    setupChecklist,
    commandCenter,
    pendingApprovalsList,
    highRiskClientsList,
    collectionRate: _collectionRate,
  } = data

  const totalCompliance = pendingComplianceCount + completedComplianceCount
  const complianceScore =
    totalCompliance > 0
      ? Math.round((completedComplianceCount / totalCompliance) * 100)
      : 100
  const workload =
    activeClients > 0 ? Math.round((totalTasks / activeClients) * 10) : 0

  const kpiData = {
    totalClients,
    activeClients,
    totalOutstanding,
    totalCollected,
    totalOverdue,
    overdueCount,
    complianceScore,
    pendingComplianceCount,
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Dashboard" }]} />
      <PageHeader
        label={`Welcome back, ${user.name}`}
        title="Partner Command Center"
        description="Full firm visibility — revenue, compliance, workforce intelligence, and approvals."
      />

      {/* Partner command center */}
      <PartnerCommandCenter
        stats={{ ...commandCenter, complianceScore }}
        pendingApprovals={pendingApprovalsList}
        highRiskClients={highRiskClientsList}
      />

      {/* Setup checklist — hidden once all steps done */}
      <SetupChecklist data={setupChecklist} />

      <ExecutiveSummary
        overdueTasks={overdueTasksCount}
        upcomingDeadlines={upcomingDeadlinesCount}
        outstandingInvoices={overdueCount}
        pendingDocuments={totalDocuments}
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
        <ComplianceOverview
          events={complianceEventsRaw}
          total={totalCompliance}
          completed={completedComplianceCount}
        />
        <OutstandingPayments invoices={serializedOutstandingInvoices} />
      </div>
    </PageContainer>
  )
}
