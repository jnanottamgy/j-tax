"use client"

import { useActionState, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  COMPLIANCE_TYPE_OPTIONS,
  WORKFLOW_STATUS_OPTIONS,
} from "@/components/compliance/compliance-type-badge"
import { createComplianceEvent, type ComplianceActionState } from "@/app/actions/compliance"

interface AddComplianceEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultClientId?: string
  clients?: Array<{ id: string; name: string }>
}

const initialState: ComplianceActionState = {}

export function AddComplianceEventDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultClientId,
  clients = [],
}: AddComplianceEventDialogProps) {
  const [state, formAction, isPending] = useActionState(createComplianceEvent, initialState)
  const [clientList, setClientList] = useState(clients)

  // Controlled fields for canSubmit guard
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")

  // Reset controlled fields when dialog opens
  useEffect(() => {
    if (open) {
      setTitle("")
      setDueDate("")
    }
  }, [open])

  // Load clients if not provided
  useEffect(() => {
    if (clients.length === 0 && open) {
      import("@/app/actions/clients").then(({ getClientsData }) =>
        getClientsData().then((d) =>
          setClientList(d.clients.map((c: any) => ({ id: c.id, name: c.name })))
        )
      )
    }
  }, [open, clients.length])

  useEffect(() => {
    if (state.success) {
      toast.success("Compliance event created")
      onSuccess?.()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, onSuccess])

  const canSubmit = title.trim().length >= 1 && dueDate.length > 0 && !isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Compliance Event</DialogTitle>
          <DialogDescription>
            Create a new compliance filing or deadline event.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="ce-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ce-title"
              name="title"
              placeholder="e.g. GSTR-1 Filing — Apr 2026"
              className="h-10 rounded-xl"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={!!state.fieldErrors?.title}
              disabled={isPending}
            />
            {state.fieldErrors?.title && (
              <p className="text-xs text-destructive">{state.fieldErrors.title[0]}</p>
            )}
          </div>

          {/* Type + Workflow Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ce-type">
                Filing Type <span className="text-destructive">*</span>
              </Label>
              <select
                id="ce-type"
                name="type"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                defaultValue="CUSTOM"
                disabled={isPending}
              >
                {COMPLIANCE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ce-workflow">Status</Label>
              <select
                id="ce-workflow"
                name="workflowStatus"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                defaultValue="NOT_STARTED"
                disabled={isPending}
              >
                {WORKFLOW_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date + Filing Period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ce-due">
                Due Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ce-due"
                name="dueDate"
                type="date"
                className="h-10 rounded-xl"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-invalid={!!state.fieldErrors?.dueDate}
                disabled={isPending}
              />
              {state.fieldErrors?.dueDate && (
                <p className="text-xs text-destructive">{state.fieldErrors.dueDate[0]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ce-period">Filing Period</Label>
              <Input
                id="ce-period"
                name="filingPeriod"
                placeholder="e.g. Apr 2026 / Q1 FY26"
                className="h-10 rounded-xl"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Client */}
          <div className="space-y-2">
            <Label htmlFor="ce-client">Client</Label>
            <select
              id="ce-client"
              name="clientId"
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              defaultValue={defaultClientId ?? ""}
              disabled={isPending}
            >
              <option value="">— No specific client —</option>
              {clientList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reminder Days */}
          <div className="space-y-2">
            <Label htmlFor="ce-reminder">Reminder (days before due)</Label>
            <Input
              id="ce-reminder"
              name="reminderDays"
              type="number"
              min="1"
              max="90"
              defaultValue="7"
              className="h-10 rounded-xl"
              disabled={isPending}
            />
            {state.fieldErrors?.reminderDays && (
              <p className="text-xs text-destructive">{state.fieldErrors.reminderDays[0]}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="ce-desc">Description</Label>
            <Textarea
              id="ce-desc"
              name="description"
              placeholder="Optional notes about this filing…"
              rows={3}
              className="rounded-xl"
              disabled={isPending}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="ce-notes">Internal Notes</Label>
            <Textarea
              id="ce-notes"
              name="notes"
              placeholder="Internal team notes…"
              rows={2}
              className="rounded-xl"
              disabled={isPending}
            />
          </div>

          {/* Statutory toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ce-statutory"
              name="isStatutory"
              value="true"
              defaultChecked
              className="h-4 w-4 rounded border-input"
              disabled={isPending}
            />
            <Label htmlFor="ce-statutory" className="cursor-pointer">
              Statutory filing (government mandated)
            </Label>
          </div>

          {state.error && (
            <p className="text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-10 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-10 rounded-xl btn-glow"
              disabled={!canSubmit}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating…
                </>
              ) : (
                "Create Event"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
