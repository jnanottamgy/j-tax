"use client"

import { useState, useTransition } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  Clock, Wifi, WifiOff, Coffee, Plane, Activity,
  CheckCircle2, FileText, Shield, Mail, Search, Settings2, LogIn, LogOut,
  Plus, Edit3, Upload, CreditCard, ChevronDown, ChevronUp,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getEmployeeDetail,
  getEmployeeTimeline,
  getProductivityChartData,
} from "@/app/actions/workforce"

type DetailData = NonNullable<Awaited<ReturnType<typeof getEmployeeDetail>>>
type TimelineData = Awaited<ReturnType<typeof getEmployeeTimeline>>
type ChartData = Awaited<ReturnType<typeof getProductivityChartData>>

type Props = {
  detail: DetailData
  initialTimeline: TimelineData
  initialChartData: ChartData
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  CLIENT_CREATED: Plus,
  CLIENT_UPDATED: Edit3,
  CLIENT_VIEWED: Activity,
  TASK_CREATED: Plus,
  TASK_UPDATED: Edit3,
  TASK_COMPLETED: CheckCircle2,
  DOCUMENT_UPLOADED: Upload,
  DOCUMENT_DOWNLOADED: FileText,
  INVOICE_CREATED: CreditCard,
  INVOICE_UPDATED: CreditCard,
  PAYMENT_UPDATED: CreditCard,
  COMPLIANCE_COMPLETED: Shield,
  COMPLIANCE_UPDATED: Shield,
  EMAIL_SENT: Mail,
  WHATSAPP_SENT: Mail,
  NOTIFICATION_SENT: Mail,
  REPORT_GENERATED: FileText,
  SEARCH_PERFORMED: Search,
  SETTINGS_CHANGED: Settings2,
}

const ACTIVITY_COLORS: Record<string, string> = {
  LOGIN: "text-emerald-500 bg-emerald-500/10",
  LOGOUT: "text-muted-foreground bg-muted/30",
  CLIENT_CREATED: "text-blue-400 bg-blue-400/10",
  CLIENT_UPDATED: "text-blue-300 bg-blue-300/10",
  TASK_CREATED: "text-purple-400 bg-purple-400/10",
  TASK_COMPLETED: "text-emerald-500 bg-emerald-500/10",
  TASK_UPDATED: "text-purple-300 bg-purple-300/10",
  DOCUMENT_UPLOADED: "text-orange-400 bg-orange-400/10",
  DOCUMENT_DOWNLOADED: "text-orange-300 bg-orange-300/10",
  INVOICE_CREATED: "text-cyan-400 bg-cyan-400/10",
  INVOICE_UPDATED: "text-cyan-300 bg-cyan-300/10",
  PAYMENT_UPDATED: "text-cyan-400 bg-cyan-400/10",
  COMPLIANCE_COMPLETED: "text-emerald-400 bg-emerald-400/10",
  COMPLIANCE_UPDATED: "text-emerald-300 bg-emerald-300/10",
  EMAIL_SENT: "text-pink-400 bg-pink-400/10",
  WHATSAPP_SENT: "text-green-400 bg-green-400/10",
  DEFAULT: "text-muted-foreground bg-muted/30",
}

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function EmployeeDetailClient({ detail, initialTimeline, initialChartData }: Props) {
  const [timeline, setTimeline] = useState(initialTimeline)
  const [chartData, setChartData] = useState(initialChartData)
  const [filter, setFilter] = useState<"today" | "week" | "month" | "custom">("today")
  const [chartPeriod, setChartPeriod] = useState<"week" | "month">("week")
  const [page, setPage] = useState(1)
  const [, startTransition] = useTransition()

  const STATUS_LABELS: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    ONLINE: { label: "Online", icon: Wifi, cls: "text-emerald-500" },
    IDLE: { label: "Idle", icon: Coffee, cls: "text-yellow-500" },
    OFFLINE: { label: "Offline", icon: WifiOff, cls: "text-muted-foreground" },
    ON_LEAVE: { label: "On Leave", icon: Plane, cls: "text-blue-400" },
  }

  const statusCfg = STATUS_LABELS[detail.status]
  const StatusIcon = statusCfg.icon

  const overdueTasks = detail.tasks.filter((t) => t.isOverdue).length
  const completedTasks = detail.tasks.filter((t) => t.status === "FILED_DONE").length
  const activeTasks = detail.tasks.filter((t) => t.status !== "FILED_DONE" && t.status !== "ON_HOLD").length

  function changeFilter(f: typeof filter) {
    setFilter(f)
    setPage(1)
    startTransition(async () => {
      const data = await getEmployeeTimeline(detail.employee.id, f, undefined, undefined, 1, 50)
      setTimeline(data)
    })
  }

  function changeChartPeriod(p: "week" | "month") {
    setChartPeriod(p)
    startTransition(async () => {
      const data = await getProductivityChartData(detail.employee.id, p)
      setChartData(data)
    })
  }

  function loadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    startTransition(async () => {
      const data = await getEmployeeTimeline(detail.employee.id, filter, undefined, undefined, nextPage, 50)
      setTimeline((prev) => ({
        ...data,
        activities: [...prev.activities, ...data.activities],
      }))
    })
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Top row: status card + quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Status</p>
            <div className="flex items-center gap-2">
              <StatusIcon className={`size-4 ${statusCfg.cls}`} />
              <span className={`font-semibold ${statusCfg.cls}`}>{statusCfg.label}</span>
            </div>
            {detail.activeSession && (
              <p className="text-xs text-muted-foreground mt-1">
                Logged in {formatDistanceToNow(new Date(detail.activeSession.loginAt), { addSuffix: true })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Active Tasks</p>
            <p className="text-2xl font-semibold">{activeTasks}</p>
            {overdueTasks > 0 && (
              <p className="text-xs text-red-500 mt-0.5">{overdueTasks} overdue</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-semibold">{completedTasks}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detail.tasks.length > 0
                ? `${Math.round((completedTasks / detail.tasks.length) * 100)}% rate`
                : "No tasks"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Today</p>
            {detail.todayAttendance ? (
              <>
                <p className={`font-semibold ${
                  detail.todayAttendance.status === "PRESENT" ? "text-emerald-500" :
                  detail.todayAttendance.status === "LATE_LOGIN" ? "text-yellow-500" :
                  detail.todayAttendance.status === "ON_LEAVE" ? "text-blue-400" : ""
                }`}>
                  {detail.todayAttendance.status.replace("_", " ")}
                </p>
                {detail.todayAttendance.loginAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    In {format(new Date(detail.todayAttendance.loginAt), "HH:mm")}
                    {detail.todayAttendance.workMinutes
                      ? ` · ${formatMinutes(detail.todayAttendance.workMinutes)}`
                      : ""}
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold text-muted-foreground">No record</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Productivity chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Productivity</CardTitle>
            <div className="flex gap-1">
              {(["week", "month"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={chartPeriod === p ? "default" : "ghost"}
                  className="h-6 px-2 text-xs capitalize"
                  onClick={() => changeChartPeriod(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No activity data for this period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.7 0.16 265)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.7 0.16 265)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl">
                        <p className="font-medium">{label}</p>
                        <p className="text-primary">{payload[0].value} actions</p>
                      </div>
                    )
                  }}
                />
                <Area type="monotone" dataKey="actions" stroke="oklch(0.7 0.16 265)" fill="url(#actGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => changeFilter(v as typeof filter)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground tabular-nums">
                {timeline.total} events
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {timeline.activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground text-sm">
              <Activity className="size-6 opacity-30" />
              <p>No activity recorded for this period.</p>
            </div>
          ) : (
            <>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/[0.06]" />
                <div className="space-y-1">
                  {timeline.activities.map((entry) => {
                    const Icon = ACTIVITY_ICONS[entry.activityType] ?? Activity
                    const colorCls = ACTIVITY_COLORS[entry.activityType] ?? ACTIVITY_COLORS.DEFAULT
                    return (
                      <div key={entry.id} className="relative flex gap-3 py-1.5 pl-2">
                        <div className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ${colorCls}`}>
                          <Icon className="size-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-sm leading-snug">{entry.description}</p>
                            {entry.entityName && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1">
                                {entry.entityName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {format(new Date(entry.performedAt), "HH:mm")}
                            {" · "}
                            {formatDistanceToNow(new Date(entry.performedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {timeline.hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" size="sm" onClick={loadMore}>
                    <ChevronDown className="size-3.5 mr-1" />
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Assigned Tasks ({detail.tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned.</p>
          ) : (
            <div className="space-y-1.5">
              {detail.tasks.slice(0, 20).map((task) => (
                <div key={task.id} className="flex items-center gap-2 py-1.5 border-b border-white/[0.05] last:border-0">
                  <div className={`size-2 shrink-0 rounded-full ${
                    task.isOverdue ? "bg-red-500" :
                    task.status === "FILED_DONE" ? "bg-emerald-500" :
                    task.status === "IN_PROGRESS" ? "bg-blue-400" : "bg-muted-foreground/40"
                  }`} />
                  <p className="text-sm flex-1 truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground shrink-0">{task.client.name}</p>
                  {task.isOverdue && (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/20 shrink-0">Overdue</Badge>
                  )}
                </div>
              ))}
              {detail.tasks.length > 20 && (
                <p className="text-xs text-muted-foreground pt-1">
                  +{detail.tasks.length - 20} more tasks
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
