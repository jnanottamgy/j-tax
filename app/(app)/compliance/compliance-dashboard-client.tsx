"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, differenceInDays } from "date-fns"
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock,
  TrendingUp, Plus, RefreshCw, ChevronRight,
  BarChart3, Calendar, Users, Loader2,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { GlassCard } from "@/components/dashboard/glass-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ComplianceTypeBadge } from "@/components/compliance/compliance-type-badge"
import { ComplianceEventModal } from "@/components/compliance/compliance-event-modal"
import { AddComplianceEventDialog } from "@/components/compliance/add-compliance-event-dialog"
import {
  updateComplianceEventStatus,
  deleteComplianceEvent,
  generateStatutoryComplianceEvents,
} from "@/app/actions/compliance"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface DashboardData {
  stats: {
    total: number
    completed: number
    overdue: number
    upcoming: number
    completionRate: number
    healthScore: number
    clientsWithCompliance: number
  }
  upcomingEvents: any[]
  recentlyCompleted: any[]
  byType: { type: string; _count: number }[]
  user: { id: string; name: string; role: string }
}

function HealthScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-400" :
    score >= 60 ? "text-yellow-400" :
    "text-red-400"
  const ringColor =
    score >= 80 ? "stroke-emerald-400" :
    score >= 60 ? "stroke-yellow-400" :
    "stroke-red-400"
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/[0.06]" />
        <circle
          cx="40" cy="40" r="36" fill="none" strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all duration-700", ringColor)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold tabular-nums", color)}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

function urgencyLabel(dueDate: Date) {
  const days = differenceInDays(new Date(dueDate), new Date())
  if (days < 0) return { label: "Overdue", cls: "text-red-400 bg-red-500/10 border-red-500/20" }
  if (days === 0) return { label: "Due Today", cls: "text-orange-400 bg-orange-500/10 border-orange-500/20" }
  if (days <= 3) return { label: `${days}d left`, cls: "text-orange-400 bg-orange-500/10 border-orange-500/20" }
  if (days <= 7) return { label: `${days}d left`, cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" }
  return { label: `${days}d left`, cls: "text-muted-foreground bg-white/[0.04] border-white/[0.08]" }
}

export function ComplianceDashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter()
  const { stats, upcomingEvents, recentlyCompleted, byType, user } = data
  const canManage = user.role === "PARTNER" || user.role === "MANAGER"

  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [isRefreshing, startRefresh] = useTransition()

  const handleEventClick = (event: any) => {
    setSelectedEvent(event)
    setModalOpen(true)
  }

  const handleStatusUpdate = async (eventId: string, status: any) => {
    const result = await updateComplianceEventStatus(eventId, status)
    if (result.success) {
      toast.success("Status updated")
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to update status")
    }
  }

  const handleDelete = async (eventId: string) => {
    const result = await deleteComplianceEvent(eventId)
    if (result.success) {
      toast.success("Event deleted")
      setModalOpen(false)
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to delete event")
    }
  }

  const handleRefresh = () => {
    startRefresh(() => { router.refresh() })
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Events",   value: stats.total,     icon: BarChart3,    color: "text-primary",      bg: "bg-primary/10" },
          { label: "Completed",      value: stats.completed, icon: CheckCircle2, color: "text-emerald-400",  bg: "bg-emerald-500/10" },
          { label: "Overdue",        value: stats.overdue,   icon: AlertTriangle,color: "text-red-400",      bg: "bg-red-500/10" },
          { label: "Due in 30 Days", value: stats.upcoming,  icon: Clock,        color: "text-yellow-400",   bg: "bg-yellow-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <GlassCard key={label} hover={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className={cn("p-2 rounded-lg", bg)}>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
            </div>
            <p className={cn("text-3xl font-bold tabular-nums", color)}>{value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="input-premium h-9 rounded-xl gap-2 border-white/[0.07] bg-transparent" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
        {canManage && (
          <Button size="sm" className="btn-glow h-9 gap-1.5 rounded-xl" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Event
          </Button>
        )}
      </div>

      {/* Health Score + Completion Rate + By Type */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Score */}
        <GlassCard hover={false} className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Compliance Health Score
            </h3>
            <p className="text-sm text-muted-foreground">Based on completion rate and overdue ratio</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <HealthScoreRing score={stats.healthScore} />
            <div className="w-full space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Completion Rate</span>
                <span className="font-medium text-foreground">{stats.completionRate}%</span>
              </div>
              <Progress value={stats.completionRate} className="h-1.5" />
              <div className="flex justify-between text-muted-foreground">
                <span>Clients Tracked</span>
                <span className="font-medium text-foreground">{stats.clientsWithCompliance}</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* By Filing Type */}
        <GlassCard hover={false} className="p-6 lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Events by Filing Type
            </h3>
          </div>
          {byType.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No compliance events yet"
              description="Add your first compliance event to start tracking deadlines"
              action={canManage ? {
                label: "Add Event",
                onClick: () => setAddOpen(true),
              } : undefined}
            />
          ) : (
            <div className="space-y-3">
              {byType.map(({ type, _count }) => {
                const pct = stats.total > 0 ? Math.round((_count / stats.total) * 100) : 0
                return (
                  <div key={type} className="flex items-center gap-3">
                    <ComplianceTypeBadge type={type as any} className="w-24 justify-center shrink-0" />
                    <div className="flex-1">
                      <Progress value={pct} className="h-2" />
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground w-12 text-right">
                      {_count} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Upcoming + Recently Completed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <GlassCard hover={false} className="p-6">
          <div className="flex flex-row items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-400" />
                Upcoming Deadlines
              </h3>
              <p className="text-sm text-muted-foreground">Next 30 days</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link href="/calendar">View Calendar <ChevronRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </div>
          <div className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No upcoming deadlines"
                description="All compliance events are up to date"
              />
            ) : (
              upcomingEvents.map((event) => {
                const { label, cls } = urgencyLabel(event.dueDate)
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors"
                    onClick={() => handleEventClick(event)}
                  >
                    <ComplianceTypeBadge type={event.type} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.title}</p>
                      {event.client && (
                        <p className="text-xs text-muted-foreground truncate">{event.client.name}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 text-xs", cls)}>
                      {label}
                    </Badge>
                  </div>
                )
              })
            )}
          </div>
        </GlassCard>

        {/* Recently Completed */}
        <GlassCard hover={false} className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Recently Completed
            </h3>
            <p className="text-sm text-muted-foreground">Last 30 days</p>
          </div>
          <div className="space-y-2">
            {recentlyCompleted.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No completions yet this month"
                description="Completed compliance events will appear here"
              />
            ) : (
              recentlyCompleted.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors"
                  onClick={() => handleEventClick(event)}
                >
                  <ComplianceTypeBadge type={event.type} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    {event.client && (
                      <p className="text-xs text-muted-foreground truncate">{event.client.name}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {event.completedAt ? format(new Date(event.completedAt), "MMM d") : "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Modals */}
      <ComplianceEventModal
        event={selectedEvent}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onStatusUpdate={handleStatusUpdate}
        onDelete={handleDelete}
        currentUser={user}
      />

      {canManage && (
        <AddComplianceEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={() => { setAddOpen(false); router.refresh() }}
        />
      )}
    </div>
  )
}
