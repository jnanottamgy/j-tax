"use client"

import { useActionState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createLead } from "@/app/actions/proposals"

const SOURCES = ["REFERRAL","WEBSITE","WALK_IN","COLD_CALL","SOCIAL_MEDIA","OTHER"]
const SOURCE_LABELS: Record<string, string> = {
  REFERRAL: "Referral", WEBSITE: "Website", WALK_IN: "Walk-in",
  COLD_CALL: "Cold Call", SOCIAL_MEDIA: "Social Media", OTHER: "Other",
}

export function AddLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, action, isPending] = useActionState(createLead, {})

  // Auto-close on success
  if (state.success && open) {
    setTimeout(onClose, 100)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" name="name" placeholder="Rajesh Kumar" required />
              {state.fieldErrors?.name && <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>}
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" placeholder="rajesh@company.com" required />
              {state.fieldErrors?.email && <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" placeholder="ABC Enterprises" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="serviceRequired">Service Required</Label>
              <Input id="serviceRequired" name="serviceRequired" placeholder="GST Filing, ITR..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedValue">Estimated Value (₹)</Label>
              <Input id="estimatedValue" name="estimatedValue" type="number" min={0} placeholder="50000" />
            </div>
            <div className="space-y-1.5">
              <Label>Lead Source</Label>
              <Select name="source" defaultValue="OTHER">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Any relevant context..." rows={2} />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Add Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
