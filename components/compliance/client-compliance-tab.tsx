"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, differenceInDays } from "date-fns"
import {
  ShieldCheck, AlertTriangle, CheckCircle2,
  Clock, Plus, Calendar,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ComplianceTypeBadge, WORKFLOW_STATUS_OPTIONS } from "@/components/compliance/compliance-type-badge"
import { ComplianceEventModal } from "@/components/compliance/compliance-event-modal"
import { AddComplianceEventDialog } from "@/components/compliance/add-compliance-event-dialog"
import {
  updateComplianceEventStatus,
  deleteComplianceEvent,
  generateStatutoryComplianceEvents,
} from "@/app/actions/compliance"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ClientComplianceTabProps {
  clientId: string
  complianceEvents: any[]
  metrics: {
    complianceScore: number
    overdueCompliance: number
    upcomingCompliance: number
  }
  canManage: boolean
  currentUser: any
}

function WorkflowBadge({ status }: { status: string }) {
  const opt = WORKFLOW_STATUS_OPTIONS.find((o) => o.value === status)
  const colorMap: Record<string, string> = {
    NOT_STARTED:       "bg-slate-500/10 text-slate-400 border-slate-500/20",
    DOCUMENTS_AWAITED: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    IN_PROGRESS:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
    UNDER_REVIEW:      "bg-purple-500/10 text-purple-400 border-purple-500/20",
    FILED:             "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    COMPLETED:         "bg-green-500/10 text-green-400 border-green-500/20",
    OVERDUE:           "bg-red-500/10 text-red-400 border-red-500/20",
  }
  return (
    <Badge variant="outline" className={cn("text-xs", colorMap[status] ?? colorMap.NOT_STARTED)}>
      {opt?.label ?? status.replace(/_/g, " ")}
    </Badge>
  )
}

export function ClientComplianceTab({
  clientId,
  complianceEvents,
  metrics,
  canManage,
  currentUser,
}: ClientComplianceTabProps) {
  const router = useRouter()
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [isGenerating, startGenerate] = useTransition()

  const now = new Date()
  const upcoming = complianceEvents
    .filter((e) => new Date(e.dueDate) >= now && e.status !== "COMPLETED")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  const overdue = complianceEvents.filter(
    (e) => (e.status === "OVERDUE" || (new Date(e.dueDate) < now && e.status !== "COMPLETED"))
  )
  const completed = complianceEvents
    .filter((e) => e.status === "COMPLETED")
    .sort((a, b) => new Date(b.completedAt ?? b.dueDate).getTime() - new Date(a.completedAt ?? a.dueDate).getTime())

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
      toast.error(result.error ?? "Failed to update")
    }
  }

  const handleDelete = async (eventId: string) => {
    const result = await deleteComplianceEvent(eventId)
    if (result.success) {
      toast.success("Event deleted")
      setModalOpen(false)
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to delete")
    }
  }

  const handleGenerate = () => {
    startGenerate(async () => {
      const result = await generateStatutoryComplianceEvents(clientId)
      if (result.success) {
        toast.success(`Generated ${result.count} compliance events`)
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to generate events")
      }
    })
  }

  const scoreColor =
    metrics.complianceScore >= 80 ? "text-emerald-400" :
    metrics.complianceScore >= 60 ? "text-yellow-400" :
    "text-red-400"

  return (
    <div className="space-y-6">
      {/* Score + Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white/[0.02] border-white/[0.08]">
          <CardContent className="p-5 flex flex-col items-center gap-2">
            <ShieldCheck className={cn("h-8 w-8", scoreColor)} />
            <p className={cn("text-3xl font-bold tabular-nums", scoreColor)}>
              {metrics.complianceScore}
            </p>
            <p className="text-xs text-muted-foreground">Health Score</p>
            <Progress value={metrics.complianceScore} className="h-1.5 w-full" />
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/[0.08]">
          <CardContent className="p-5 flex flex-col items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-3xl font-bold tabular-nums text-red-400">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">Overdue Filings</p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/[0.08]">
          <CardContent className="p-5 flex flex-col items-center gap-2">
            <Clock className="h-8 w-8 text-yellow-400" />
            <p className="text-3xl font-bold tabular-nums text-yellow-400">{upcoming.length}</p>
            <p className="text-xs text-muted-foreground">Upcoming Deadlines</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="btn-glow h-9 gap-1.5 rounded-xl" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Event
          </Button>
          <Button
            size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl"
            onClick={handleGenerate} disabled={isGenerating}
          >
            <Calendar className="h-3.5 w-3.5" />
            {isGenerating ? "Generating..." : "Auto-Generate Schedule"}
          </Button>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Overdue ({overdue.length})
          </h3>
          <div className="space-y-2">
            {overdue.map((event) => {
              const daysOverdue = Math.abs(differenceInDays(new Date(event.dueDate), now))
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 cursor-pointer transition-colors"
                  onClick={() => handleEventClick(event)}
                >
                  <ComplianceTypeBadge type={event.type} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    {event.filingPeriod && (
                      <p className="text-xs text-muted-foreground">{event.filingPeriod}</p>
                    )}
                  </div>
                  <WorkflowBadge status={event.workflowStatus ?? "NOT_STARTED"} />
                  <Badge variant="outline" className="shrink-0 text-xs bg-red-500/10 text-red-400 border-red-500/20">
                    {daysOverdue}d overdue
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-400" />
            Upcoming Filings ({upcoming.length})
          </h3>
          <div className="space-y-2">
            {upcoming.slice(0, 8).map((event) => {
              const days = differenceInDays(new Date(event.dueDate), now)
              const urgencyCls =
                days <= 3 ? "text-red-400 bg-red-500/10 border-red-500/20" :
                days <= 7 ? "text-orange-400 bg-orange-500/10 border-orange-500/20" :
                days <= 14 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
                "text-muted-foreground bg-white/[0.04] border-white/[0.08]"
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors"
                  onClick={() => handleEventClick(event)}
                >
                  <ComplianceTypeBadge type={event.type} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {format(new Date(event.dueDate), "MMM d, yyyy")}
                      {event.filingPeriod && ` · ${event.filingPeriod}`}
                    </p>
                  </div>
                  <WorkflowBadge status={event.workflowStatus ?? "NOT_STARTED"} />
                  <Badge variant="outline" className={cn("shrink-0 text-xs", urgencyCls)}>
                    {days === 0 ? "Today" : `${days}d`}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Compliance History */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Compliance History ({completed.length})
          </h3>
          <div className="space-y-2">
            {completed.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] cursor-pointer transition-colors opacity-80"
                onClick={() => handleEventClick(event)}
              >
                <ComplianceTypeBadge type={event.type} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.completedAt
                      ? `Completed ${format(new Date(event.completedAt), "MMM d, yyyy")}`
                      : `Due ${format(new Date(event.dueDate), "MMM d, yyyy")}`}
                    {event.filingPeriod && ` · ${event.filingPeriod}`}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs bg-green-500/10 text-green-400 border-green-500/20">
                  Completed
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {complianceEvents.length === 0 && (
        <div className="text-center py-12">
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground mb-4">No compliance events yet</p>
          {canManage && (
            <div className="flex justify-center gap-2">
              <Button size="sm" className="btn-glow" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />Add Event
              </Button>
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isGenerating}>
                <Calendar className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating..." : "Auto-Generate"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <ComplianceEventModal
        event={selectedEvent}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onStatusUpdate={handleStatusUpdate}
        onDelete={handleDelete}
        currentUser={currentUser}
      />

      {canManage && (
        <AddComplianceEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          defaultClientId={clientId}
          onSuccess={() => { setAddOpen(false); router.refresh() }}
        />
      )}
    </div>
  )
}
