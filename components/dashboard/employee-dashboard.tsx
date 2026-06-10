"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface EmployeeTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  client: { name: string } | null
}

interface EmployeeClient {
  id: string
  name: string
  clientCode: string
  status: string
}

interface ComplianceEvent {
  id: string
  title: string
  dueDate: string
  status: string
  client?: { name: string } | null
}

interface EmployeeDashboardProps {
  employeeName: string
  stats: {
    totalTasks: number
    completedTasks: number
    overdueTasks: number
    tasksDueToday: number
    totalClients: number
    activeClients: number
    pendingCompliance: number
  }
  todayTasks: EmployeeTask[]
  myTasks: EmployeeTask[]
  myClients: EmployeeClient[]
  upcomingCompliance: ComplianceEvent[]
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-red-400 bg-red-400/10",
  HIGH: "text-orange-400 bg-orange-400/10",
  MEDIUM: "text-yellow-400 bg-yellow-400/10",
  LOW: "text-green-400 bg-green-400/10",
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  DATA_AWAITED: "Data Awaited",
  UNDER_REVIEW: "Under Review",
  FILED_DONE: "Filed",
  ON_HOLD: "On Hold",
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  const today = new Date()
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  return `${diff}d left`
}

export function EmployeeDashboard({
  employeeName,
  stats,
  todayTasks,
  myTasks,
  myClients,
  upcomingCompliance,
}: EmployeeDashboardProps) {
  const completionRate =
    stats.totalTasks > 0
      ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
      : 0

  const activeTasks = myTasks.filter((t) => t.status !== "FILED_DONE").slice(0, 6)

  return (
    <div className="space-y-6">
      {/* Personal KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <ClipboardList className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">My Tasks</p>
                <p className="text-2xl font-bold">{stats.totalTasks}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Completed</span>
                <span>{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10">
                <AlertTriangle className="size-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-400">{stats.overdueTasks}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {stats.overdueTasks === 0 ? "All tasks on time 🎉" : "Needs immediate attention"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Clock className="size-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold text-amber-400">{stats.tasksDueToday}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Tasks requiring action today
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Users className="size-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">My Clients</p>
                <p className="text-2xl font-bold">{stats.totalClients}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {stats.activeClients} active
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Today's work */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-amber-400" />
              Today&apos;s Work
              {todayTasks.length > 0 && (
                <Badge className="ml-auto bg-amber-400/15 text-amber-400 text-[10px]">
                  {todayTasks.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="size-8 text-green-400/60" />
                <p className="text-sm text-muted-foreground">No tasks due today</p>
              </div>
            ) : (
              todayTasks.map((task) => (
                <Link
                  key={task.id}
                  href="/work-tracker"
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{task.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {task.client?.name ?? "—"}
                    </p>
                  </div>
                  <Badge
                    className={`ml-2 shrink-0 text-[10px] ${PRIORITY_COLORS[task.priority] ?? ""}`}
                  >
                    {task.priority}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* My active tasks */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="size-4 text-primary" />
              My Active Tasks
              <Link
                href="/work-tracker"
                className="ml-auto text-[11px] font-normal text-muted-foreground hover:text-foreground"
              >
                View all →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No active tasks
              </p>
            ) : (
              activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {task.client?.name ?? "—"}
                      </p>
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground/70">
                          · {formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className="ml-2 shrink-0 bg-white/[0.05] text-[10px] text-muted-foreground">
                    {STATUS_LABELS[task.status] ?? task.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* My clients */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-blue-400" />
              My Clients
              <Link
                href="/clients"
                className="ml-auto text-[11px] font-normal text-muted-foreground hover:text-foreground"
              >
                View all →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myClients.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No clients assigned yet
              </p>
            ) : (
              myClients.slice(0, 5).map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-[13px] font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.clientCode}</p>
                  </div>
                  <Badge
                    className={`text-[10px] ${
                      client.status === "ACTIVE"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-white/[0.05] text-muted-foreground"
                    }`}
                  >
                    {client.status}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Compliance queue */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-green-400" />
              My Compliance Queue
              {stats.pendingCompliance > 0 && (
                <Badge className="ml-auto bg-red-400/15 text-red-400 text-[10px]">
                  {stats.pendingCompliance} pending
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingCompliance.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="size-8 text-green-400/60" />
                <p className="text-sm text-muted-foreground">All compliance up to date</p>
              </div>
            ) : (
              upcomingCompliance.slice(0, 5).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.client?.name ?? "—"} · {formatDate(event.dueDate)}
                    </p>
                  </div>
                  <Badge
                    className={`ml-2 shrink-0 text-[10px] ${
                      event.status === "OVERDUE"
                        ? "bg-red-400/10 text-red-400"
                        : "bg-amber-400/10 text-amber-400"
                    }`}
                  >
                    {event.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personal performance */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-purple-400" />
            My Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Task Completion Rate</p>
              <p className="text-2xl font-bold">{completionRate}%</p>
              <Progress value={completionRate} className="h-2" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tasks Completed</p>
              <p className="text-2xl font-bold">{stats.completedTasks}</p>
              <p className="text-xs text-muted-foreground">out of {stats.totalTasks} total</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Compliance Pending</p>
              <p className="text-2xl font-bold">{stats.pendingCompliance}</p>
              <p className="text-xs text-muted-foreground">filings due</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
