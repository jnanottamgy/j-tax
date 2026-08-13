"use client"

/**
 * Hand a team member's work to someone else.
 *
 * Deleting was correctly blocked while somebody held live work — but the error
 * said "reassign them first" and there was no tool anywhere in the product to
 * do it, so a partner was expected to open forty records by hand. Disabling had
 * the opposite failure: it went through and left the work on an account that
 * could no longer open it.
 *
 * Both now route here.
 */

import { useEffect, useState, useTransition } from "react"
import { ArrowRight, Building2, CheckCircle2, ClipboardList, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  getEmployeeWorkload,
  getReassignTargets,
  reassignEmployeeWork,
  type EmployeeWorkload,
} from "@/app/actions/employees"

type Target = { id: string; name: string; openTasks: number }

export function HandoverDialog({
  employeeId,
  open,
  onOpenChange,
  onDone,
}: {
  employeeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fired after a successful handover so the caller can refresh. */
  onDone?: (moved: { tasks: number; clients: number }) => void
}) {
  const [workload, setWorkload] = useState<EmployeeWorkload | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [toId, setToId] = useState("")
  const [includeTasks, setIncludeTasks] = useState(true)
  const [includeClients, setIncludeClients] = useState(true)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !employeeId) return
    setError("")
    setToId("")
    setWorkload(null)
    Promise.all([getEmployeeWorkload(employeeId), getReassignTargets(employeeId)])
      .then(([w, t]) => {
        setWorkload(w)
        setTargets(t)
      })
      .catch(() => setError("Could not load what this person is holding."))
  }, [open, employeeId])

  const nothingToMove =
    workload != null && workload.openTasks === 0 && workload.clients === 0

  function handleSubmit() {
    if (!employeeId || !toId) return
    setError("")
    startTransition(async () => {
      const result = await reassignEmployeeWork({
        fromEmployeeId: employeeId,
        toEmployeeId: toId,
        includeTasks,
        includeClients,
      })
      if (!result.success) {
        setError(result.error ?? "Could not move the work.")
        return
      }
      onDone?.({ tasks: result.tasks, clients: result.clients })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {workload ? `Hand over ${workload.employeeName}'s work` : "Hand over work"}
          </DialogTitle>
          <DialogDescription>
            Open tasks and client ownership move across. Completed work stays where it
            is — that&apos;s the record of who did it.
          </DialogDescription>
        </DialogHeader>

        {!workload ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking what they&apos;re holding…
          </div>
        ) : nothingToMove ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <p className="text-sm text-muted-foreground">
              {workload.employeeName} isn&apos;t holding any open work or clients. Nothing
              to hand over.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* What's actually at stake */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <input
                  type="checkbox"
                  checked={includeTasks}
                  onChange={(e) => setIncludeTasks(e.target.checked)}
                  disabled={workload.openTasks === 0}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <ClipboardList className="size-3.5 text-muted-foreground" />
                    {workload.openTasks} open task{workload.openTasks === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {workload.overdueTasks > 0
                      ? `${workload.overdueTasks} already overdue`
                      : "None overdue"}
                    {workload.underReview > 0 && ` · ${workload.underReview} under review`}
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                <input
                  type="checkbox"
                  checked={includeClients}
                  onChange={(e) => setIncludeClients(e.target.checked)}
                  disabled={workload.clients === 0}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    {workload.clients} client{workload.clients === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Relationship owner</p>
                </div>
              </label>
            </div>

            <div>
              <Label htmlFor="handover-to">Hand over to</Label>
              <select
                id="handover-to"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="input-premium mt-2 h-10 w-full rounded-xl px-3 text-sm"
              >
                <option value="">Choose a team member…</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.openTasks} open
                  </option>
                ))}
              </select>
              {targets.length === 0 && (
                <p className="mt-2 text-xs text-amber-400">
                  No other active team members to hand work to. Add or re-enable someone
                  first.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Each task goes back to &quot;waiting to be accepted&quot; — the new owner
                hasn&apos;t agreed to it yet.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {nothingToMove ? "Close" : "Cancel"}
          </Button>
          {!nothingToMove && (
            <Button
              onClick={handleSubmit}
              disabled={pending || !toId || (!includeTasks && !includeClients)}
              className="gap-2"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Hand over
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
