"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { updateLead } from "@/app/actions/proposals"

const SOURCES = ["REFERRAL", "WEBSITE", "WALK_IN", "COLD_CALL", "SOCIAL_MEDIA", "OTHER"]
const SOURCE_LABELS: Record<string, string> = {
  REFERRAL: "Referral",
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  COLD_CALL: "Cold Call",
  SOCIAL_MEDIA: "Social Media",
  OTHER: "Other",
}

interface EditLeadDialogLead {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  serviceRequired: string | null
  source: string
  estimatedValue: number | null
  notes: string | null
}

export function EditLeadDialog({
  lead,
  open,
  onClose,
}: {
  lead: EditLeadDialogLead
  open: boolean
  onClose: () => void
}) {
  const [state, action, isPending] = useActionState(updateLead.bind(null, lead.id), {})
  const [name, setName] = useState(lead.name)
  const [email, setEmail] = useState(lead.email)
  const closedRef = useRef(false)

  // Reset fields to the lead's current values when dialog opens
  useEffect(() => {
    if (open) {
      setName(lead.name)
      setEmail(lead.email)
      closedRef.current = false
    }
  }, [open, lead.name, lead.email])

  // Auto-close once on success — never in render body
  useEffect(() => {
    if (state.success && open && !closedRef.current) {
      closedRef.current = true
      onClose()
    }
  }, [state.success, open, onClose])

  const canSubmit = name.trim().length >= 1 && email.trim().length > 0 && !isPending

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="edit-lead-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-lead-name"
                name="name"
                placeholder="Rajesh Kumar"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!state.fieldErrors?.name}
                disabled={isPending}
              />
              {state.fieldErrors?.name && (
                <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
              )}
            </div>

            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="edit-lead-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-lead-email"
                name="email"
                type="email"
                placeholder="rajesh@company.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!state.fieldErrors?.email}
                disabled={isPending}
              />
              {state.fieldErrors?.email && (
                <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-lead-phone">Phone</Label>
              <Input
                id="edit-lead-phone"
                name="phone"
                placeholder="+91 98765 43210"
                defaultValue={lead.phone ?? ""}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-lead-company">Company</Label>
              <Input
                id="edit-lead-company"
                name="company"
                placeholder="ABC Enterprises"
                defaultValue={lead.company ?? ""}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-lead-service">Service Required</Label>
              <Input
                id="edit-lead-service"
                name="serviceRequired"
                placeholder="GST Filing, ITR…"
                defaultValue={lead.serviceRequired ?? ""}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-lead-value">Estimated Value (₹)</Label>
              <Input
                id="edit-lead-value"
                name="estimatedValue"
                type="number"
                min={0}
                step={1}
                placeholder="50000"
                defaultValue={lead.estimatedValue ?? ""}
                disabled={isPending}
              />
              {state.fieldErrors?.estimatedValue && (
                <p className="text-xs text-destructive">{state.fieldErrors.estimatedValue[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Lead Source</Label>
              <Select name="source" defaultValue={lead.source} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SOURCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-lead-notes">Notes</Label>
            <Textarea
              id="edit-lead-notes"
              name="notes"
              placeholder="Any relevant context…"
              rows={2}
              defaultValue={lead.notes ?? ""}
              disabled={isPending}
            />
          </div>

          {state.error && (
            <p className="text-sm text-destructive rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
