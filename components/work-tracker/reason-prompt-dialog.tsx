"use client"

/**
 * "Say what needs changing."
 *
 * Sending work back used to notify the assignee with "check the task comments"
 * and require no comment — the single most common complaint about review
 * workflows, and the app did exactly it. Reopening something already filed had
 * the same gap.
 *
 * The text is written to the task's comment thread, not only to a notification,
 * because that is where somebody looks a week later.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function ReasonPromptDialog({
  open,
  message,
  value,
  onChange,
  onCancel,
  onSubmit,
}: {
  open: boolean
  message: string
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">One more thing</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="The GSTR-1 figures don't match the sales register for March — please recheck before resubmitting."
          rows={4}
          className="input-premium rounded-xl"
          autoFocus
        />

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!value.trim()}>
            Save and send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
