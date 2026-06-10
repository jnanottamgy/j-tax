"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Users, Activity, TrendingUp, AlertTriangle, Clock, Calendar } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getWorkforceDashboard,
  getPerformanceMetrics,
  getTeamComparisonData,
  getAttendanceReport,
  type PerformanceMetrics,
  type WorkloadAlert,
} from "@/app/actions/workforce"
import { EmployeeStatusGrid } from "./employee-status-grid"
import { PerformanceScorecardTable } from "./performance-scorecard-table"
import { WorkloadAlertsPanel } from "./workload-alerts-panel"
import { AttendanceReportTable } from "./attendance-report-table"
import { TeamComparisonChart } from "./team-comparison-chart"

type DashboardData = Awaited<ReturnType<typeof getWorkforceDashboard>>
type ComparisonData = Awaited<ReturnType<typeof getTeamComparisonData>>
type AttendanceData = Awaited<ReturnType<typeof getAttendanceReport>>

type Props = {
  initialDashboard: DashboardData
  initialPerformance: PerformanceMetrics[]
  initialAlerts: WorkloadAlert[]
  initialComparison: ComparisonData
}

export function WorkforceDashboardClient({
  initialDashboard,
  initialPerformance,
  initialAlerts,
  initialComparison,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [performance, setPerformance] = useState(initialPerformance)
  const [alerts, _setAlerts] = useState(initialAlerts)
  const [comparison, setComparison] = useState(initialComparison)
  const [attendance, setAttendance] = useState<AttendanceData | null>(null)
  const [perfPeriod, setPerfPeriod] = useState<"day" | "week" | "month" | "quarter">("month")
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { summary } = dashboard

  const highAlerts = alerts.filter((a) => a.severity === "HIGH").length

  async function refreshStatus() {
    setIsRefreshing(true)
    try {
      const fresh = await getWorkforceDashboard()
      setDashboard(fresh)
    } finally {
      setIsRefreshing(false)
    }
  }

  async function changePerfPeriod(period: "day" | "week" | "month" | "quarter") {
    setPerfPeriod(period)
    startTransition(async () => {
      const [perf, comp] = await Promise.all([
        getPerformanceMetrics(period),
        getTeamComparisonData(period === "week" ? "week" : "month"),
      ])
      setPerformance(perf)
      setComparison(comp)
    })
  }

  async function loadAttendance() {
    if (attendance) return
    const now = new Date()
    const data = await getAttendanceReport(now.getFullYear(), now.getMonth() + 1)
    setAttendance(data)
  }

  return (
    <div className="space-y-6 mt-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <SummaryCard
          label="Total Staff"
          value={summary.total}
          icon={<Users className="size-4" />}
          variant="default"
        />
        <SummaryCard
          label="Online Now"
          value={summary.online}
          icon={<span className="size-2 rounded-full bg-emerald-500 inline-block" />}
          variant="green"
        />
        <SummaryCard
          label="Idle"
          value={summary.idle}
          icon={<Clock className="size-4" />}
          variant="yellow"
        />
        <SummaryCard
          label="Offline"
          value={summary.offline}
          icon={<span className="size-2 rounded-full bg-muted-foreground inline-block" />}
          variant="default"
        />
        <SummaryCard
          label="On Leave"
          value={summary.onLeave}
          icon={<Calendar className="size-4" />}
          variant="blue"
        />
        <SummaryCard
          label="Alerts"
          value={highAlerts}
          icon={<AlertTriangle className="size-4" />}
          variant={highAlerts > 0 ? "red" : "default"}
        />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="status">
        <div className="flex items-center justify-between mb-2">
          <TabsList>
            <TabsTrigger value="status">
              <Activity className="size-3.5 mr-1.5" />
              Live Status
            </TabsTrigger>
            <TabsTrigger value="performance">
              <TrendingUp className="size-3.5 mr-1.5" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="attendance" onClick={loadAttendance}>
              <Calendar className="size-3.5 mr-1.5" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="size-3.5 mr-1.5" />
              Alerts
              {highAlerts > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">
                  {highAlerts}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={refreshStatus} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <TabsContent value="status" className="mt-0">
          <EmployeeStatusGrid
            employees={dashboard.statusCards}
            onEmployeeClick={(id) => router.push(`/workforce/${id}`)}
          />
        </TabsContent>

        <TabsContent value="performance" className="mt-0 space-y-4">
          <div className="flex gap-2">
            {(["day", "week", "month", "quarter"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={perfPeriod === p ? "default" : "outline"}
                onClick={() => changePerfPeriod(p)}
                className="capitalize"
              >
                {p}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PerformanceScorecardTable
                metrics={performance}
                onEmployeeClick={(id) => router.push(`/workforce/${id}`)}
              />
            </div>
            <TeamComparisonChart data={comparison} />
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-0">
          {attendance ? (
            <AttendanceReportTable data={attendance} />
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Loading attendance data…
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="mt-0">
          <WorkloadAlertsPanel
            alerts={alerts}
            onEmployeeClick={(id) => router.push(`/workforce/${id}`)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

const variantClasses: Record<string, string> = {
  default: "border-white/10",
  green: "border-emerald-500/20 bg-emerald-500/5",
  yellow: "border-yellow-500/20 bg-yellow-500/5",
  blue: "border-blue-500/20 bg-blue-500/5",
  red: "border-red-500/20 bg-red-500/5",
}

function SummaryCard({
  label,
  value,
  icon,
  variant = "default",
}: {
  label: string
  value: number
  icon: React.ReactNode
  variant?: keyof typeof variantClasses
}) {
  return (
    <Card className={`${variantClasses[variant]} transition-colors`}>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  )
}
