"use client"

import { useActionState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  COMPLIANCE_TYPE_OPTIONS,
  WORKFLOW_STATUS_OPTIONS,
} from "@/components/compliance/compliance-type-badge"
import { updateComplianceEvent, type ComplianceActionState } from "@/app/actions/compliance"

interface EditComplianceEventDialogProps {
  event: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  clients?: Array<{ id: string; name: string }>
}

const initialState: ComplianceActionState = {}

export function EditComplianceEventDialog({
  event,
  open,
  onOpenChange,
  onSuccess,
  clients = [],
}: EditComplianceEventDialogProps) {
  const [state, formAction, isPending] = useActionState(updateComplianceEvent, initialState)

  useEffect(() => {
    if (state.success) {
      toast.success("Compliance event updated")
      onSuccess?.()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, onSuccess])

  if (!event) return null

  const dueDateStr = event.dueDate
    ? format(new Date(event.dueDate), "yyyy-MM-dd")
    : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Compliance Event</DialogTitle>
          <DialogDescription>Update the details of this compliance filing.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-2">
          <input type="hidden" name="id" value={event.id} />

          <div className="space-y-2">
            <Label htmlFor="ece-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="ece-title" name="title"
              defaultValue={event.title}
              className="h-10 rounded-xl" required
            />
            {state.fieldErrors?.title && (
              <p className="text-xs text-destructive">{state.fieldErrors.title[0]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ece-type">Filing Type <span className="text-destructive">*</span></Label>
              <select
                id="ece-type" name="type"
                defaultValue={event.type}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {COMPLIANCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ece-workflow">Status</Label>
              <select
                id="ece-workflow" name="workflowStatus"
                defaultValue={event.workflowStatus ?? "NOT_STARTED"}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {WORKFLOW_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ece-due">Due Date <span className="text-destructive">*</span></Label>
              <Input
                id="ece-due" name="dueDate" type="date"
                defaultValue={dueDateStr}
                className="h-10 rounded-xl" required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ece-period">Filing Period</Label>
              <Input
                id="ece-period" name="filingPeriod"
                defaultValue={event.filingPeriod ?? ""}
                placeholder="e.g. Apr 2026"
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          {clients.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="ece-client">Client</Label>
              <select
                id="ece-client" name="clientId"
                defaultValue={event.clientId ?? ""}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">— No specific client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ece-reminder">Reminder (days before due)</Label>
            <Input
              id="ece-reminder" name="reminderDays" type="number"
              min="0" max="90"
              defaultValue={event.reminderDays ?? 7}
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ece-desc">Description</Label>
            <Textarea
              id="ece-desc" name="description"
              defaultValue={event.description ?? ""}
              rows={3} className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ece-notes">Internal Notes</Label>
            <Textarea
              id="ece-notes" name="notes"
              defaultValue={event.notes ?? ""}
              rows={2} className="rounded-xl"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="ece-statutory" name="isStatutory"
              value="true" defaultChecked={event.isStatutory}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="ece-statutory" className="cursor-pointer">
              Statutory filing
            </Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button" variant="outline"
              className="flex-1 h-10 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-10 rounded-xl btn-glow"
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
              ) : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
