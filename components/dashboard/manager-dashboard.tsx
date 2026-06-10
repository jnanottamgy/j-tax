"use client"

import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface TeamMemberWorkload {
  employee: {
    id: string
    name: string
    department: string | null
  }
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  productivity: number
}

interface UrgentItem {
  type: "TASK" | "COMPLIANCE" | "INVOICE"
  title: string
  clientName: string
  dueDate: string | null
  priority?: string
}

interface ManagerDashboardProps {
  managerName: string
  teamStats: {
    totalEmployees: number
    totalActiveTasks: number
    completedThisWeek: number
    overdueTotal: number
    totalClients: number
    pendingCompliance: number
    collectionRate: number
    totalOutstanding: number
  }
  teamWorkload: TeamMemberWorkload[]
  urgentItems: UrgentItem[]
  recentActivity: Array<{
    id: string
    action: string
    description: string
    timestamp: string
    entityType: string
  }>
}

const URGENCY_COLORS: Record<string, string> = {
  TASK: "text-blue-400",
  COMPLIANCE: "text-amber-400",
  INVOICE: "text-red-400",
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  const today = new Date()
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return `${diff}d`
}

function ProductivityBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-green-400" : value >= 60 ? "bg-amber-400" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-[11px] text-muted-foreground">{value}%</span>
    </div>
  )
}

export function ManagerDashboard({
  managerName: _managerName,
  teamStats,
  teamWorkload,
  urgentItems,
  recentActivity: _recentActivity,
}: ManagerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Team KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team Size</p>
                <p className="text-2xl font-bold">{teamStats.totalEmployees}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {teamStats.totalClients} clients assigned
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
                <ClipboardList className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Tasks</p>
                <p className="text-2xl font-bold">{teamStats.totalActiveTasks}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {teamStats.completedThisWeek} completed this week
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10">
                <AlertTriangle className="size-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overdue Tasks</p>
                <p className="text-2xl font-bold text-red-400">{teamStats.overdueTotal}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {teamStats.pendingCompliance} compliance pending
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-green-500/10">
                <TrendingUp className="size-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collection Rate</p>
                <p className="text-2xl font-bold">{teamStats.collectionRate}%</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              ₹{(teamStats.totalOutstanding / 100000).toFixed(1)}L outstanding
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Team workload distribution */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="size-4 text-primary" />
              Team Workload
              <Link
                href="/employees"
                className="ml-auto text-[11px] font-normal text-muted-foreground hover:text-foreground"
              >
                Manage team →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamWorkload.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No team data available
              </p>
            ) : (
              teamWorkload.slice(0, 6).map(({ employee, totalTasks, completedTasks, overdueTasks, productivity }) => (
                <div key={employee.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium">{employee.name}</span>
                      {employee.department && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {employee.department}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{completedTasks}/{totalTasks}</span>
                      {overdueTasks > 0 && (
                        <Badge className="bg-red-400/10 text-red-400 text-[9px]">
                          {overdueTasks} OD
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ProductivityBar value={productivity} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Urgent items */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-red-400" />
              Urgent Items
              {urgentItems.length > 0 && (
                <Badge className="ml-auto bg-red-400/15 text-red-400 text-[10px]">
                  {urgentItems.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="size-8 text-green-400/60" />
                <p className="text-sm text-muted-foreground">No urgent items</p>
              </div>
            ) : (
              urgentItems.slice(0, 6).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.clientName} · {formatDate(item.dueDate)}
                    </p>
                  </div>
                  <Badge
                    className={`ml-2 shrink-0 bg-white/[0.05] text-[10px] ${URGENCY_COLORS[item.type] ?? "text-muted-foreground"}`}
                  >
                    {item.type}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Compliance status */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-green-400" />
              Compliance Status
              <Link
                href="/compliance"
                className="ml-auto text-[11px] font-normal text-muted-foreground hover:text-foreground"
              >
                View all →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">
                  {teamStats.pendingCompliance}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">
                  {urgentItems.filter((i) => i.type === "COMPLIANCE").length}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Overdue</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">
                  {teamStats.totalClients}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SLA / task timing */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-blue-400" />
              SLA Tracking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamStats.totalActiveTasks > 0 ? (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>On-time tasks</span>
                      <span>
                        {teamStats.totalActiveTasks - teamStats.overdueTotal}/{teamStats.totalActiveTasks}
                      </span>
                    </div>
                    <Progress
                      value={Math.round(
                        ((teamStats.totalActiveTasks - teamStats.overdueTotal) /
                          teamStats.totalActiveTasks) *
                          100
                      )}
                      className="h-2"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {teamStats.overdueTotal} tasks are overdue across the team
                  </p>
                  {teamStats.overdueTotal > 5 && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                      <AlertTriangle className="size-3.5 shrink-0 text-red-400" />
                      <p className="text-[12px] text-red-400">
                        High overdue count — review task assignments
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  No active tasks
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
