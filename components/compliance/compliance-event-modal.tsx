"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import {
  X, Calendar, Clock, AlertTriangle, CheckCircle2,
  Link as LinkIcon, Pencil, Loader2,
} from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  ComplianceTypeBadge,
  WORKFLOW_STATUS_OPTIONS,
  type ComplianceType,
} from "./compliance-type-badge"
import { EditComplianceEventDialog } from "./edit-compliance-event-dialog"
import { updateComplianceWorkflowStatus } from "@/app/actions/compliance"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type ComplianceEventStatus = "PENDING" | "COMPLETED" | "OVERDUE" | "CANCELLED"

interface ComplianceEvent {
  id: string
  type: ComplianceType
  title: string
  description?: string | null
  dueDate: Date
  status: ComplianceEventStatus
  workflowStatus?: string
  isStatutory: boolean
  reminderDays: number
  filingPeriod?: string | null
  notes?: string | null
  client?: { id: string; name: string } | null
  taskId?: string | null
  completedAt?: Date | null
}

interface ComplianceEventModalProps {
  event: ComplianceEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate?: (eventId: string, status: ComplianceEventStatus) => void
  onDelete?: (eventId: string) => void
  currentUser?: { id: string; name: string; role: string }
}

const STATUS_BADGE: Record<ComplianceEventStatus, string> = {
  PENDING:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
  OVERDUE:   "bg-red-500/10 text-red-400 border-red-500/20",
  CANCELLED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
}

export function ComplianceEventModal({
  event,
  open,
  onOpenChange,
  onStatusUpdate,
  onDelete,
  currentUser,
}: ComplianceEventModalProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [isUpdating, startUpdate] = useTransition()

  const canModify = currentUser?.role === "PARTNER" || currentUser?.role === "MANAGER"

  const handleWorkflowChange = (wfStatus: string) => {
    if (!event) return
    startUpdate(async () => {
      const result = await updateComplianceWorkflowStatus(event.id, wfStatus as any)
      if (result.success) {
        toast.success(`Status updated to ${wfStatus.replace(/_/g, " ")}`)
        onOpenChange(false)
        // Trigger parent refresh via onStatusUpdate with derived outer status
        const outerStatus: ComplianceEventStatus =
          wfStatus === "COMPLETED" || wfStatus === "FILED" ? "COMPLETED" :
          wfStatus === "OVERDUE" ? "OVERDUE" : "PENDING"
        onStatusUpdate?.(event.id, outerStatus)
      } else {
        toast.error(result.error ?? "Failed to update status")
      }
    })
  }

  const handleDelete = async () => {
    if (!event) return
    if (!confirm("Delete this compliance event? This cannot be undone.")) return
    onDelete?.(event.id)
  }

  if (!event) return null

  const currentWf = event.workflowStatus ?? "NOT_STARTED"

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background/95 backdrop-blur max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-semibold mb-2 pr-8">{event.title}</DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <ComplianceTypeBadge type={event.type} />
                  <Badge variant="outline" className={STATUS_BADGE[event.status]}>
                    {event.status}
                  </Badge>
                  {event.isStatutory && (
                    <Badge variant="outline" className="bg-white/[0.04] text-xs">
                      Statutory
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 shrink-0" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(event.dueDate), "PPP")}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reminder</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {event.reminderDays} days before
                </div>
              </div>
              {event.filingPeriod && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Filing Period</Label>
                  <div className="text-sm font-medium">{event.filingPeriod}</div>
                </div>
              )}
              {event.client && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Client</Label>
                  <div className="text-sm font-medium">{event.client.name}</div>
                </div>
              )}
              {event.completedAt && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Completed</Label>
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {format(new Date(event.completedAt), "PPP")}
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="text-sm bg-white/[0.02] border border-white/[0.08] rounded-lg p-3">
                  {event.description}
                </div>
              </div>
            )}

            {event.notes && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Internal Notes</Label>
                <div className="text-sm bg-white/[0.02] border border-white/[0.08] rounded-lg p-3 text-muted-foreground">
                  {event.notes}
                </div>
              </div>
            )}

            {event.taskId && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Linked Task</Label>
                <div className="flex items-center gap-2 text-sm bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  <span className="text-primary">Task linked</span>
                </div>
              </div>
            )}

            {/* Workflow Status */}
            {canModify && (
              <div className="space-y-3 pt-3 border-t border-white/[0.08]">
                <Label className="text-xs text-muted-foreground">Workflow Status</Label>
                <div className="flex flex-wrap gap-2">
                  {WORKFLOW_STATUS_OPTIONS.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={currentWf === opt.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleWorkflowChange(opt.value)}
                      disabled={isUpdating}
                      className={cn(
                        "text-xs h-8",
                        currentWf === opt.value && "btn-glow"
                      )}
                    >
                      {isUpdating && currentWf !== opt.value ? null : null}
                      {opt.label}
                    </Button>
                  ))}
                </div>
                {isUpdating && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating...
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {canModify && (
              <div className="flex gap-2 pt-3 border-t border-white/[0.08]">
                <Button
                  variant="outline" size="sm"
                  className="flex-1 gap-2"
                  onClick={() => { onOpenChange(false); setEditOpen(true) }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit Event
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                >
                  <X className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog — opens after modal closes */}
      {canModify && (
        <EditComplianceEventDialog
          event={event}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={() => {
            setEditOpen(false)
            onStatusUpdate?.(event.id, event.status)
          }}
        />
      )}
    </>
  )
}
