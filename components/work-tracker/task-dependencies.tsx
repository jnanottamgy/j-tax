"use client"

/**
 * Dependencies section for the task drawer — manage what this task waits on
 * ("blocked by") and see what waits on it ("blocks"). Open blockers freeze
 * forward status moves server-side; this UI makes that visible and editable.
 */

import { useState } from "react"
import { Link2, Loader2, Lock, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  addTaskDependency,
  removeTaskDependency,
  getDependencyOptions,
} from "@/app/actions/task-dependencies"
import { cn } from "@/lib/utils"

export type DependencyRef = { id: string; title: string; status: string }

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        status === "FILED_DONE" ? "bg-emerald-400" : "bg-amber-400"
      )}
    />
  )
}

export function TaskDependencies({
  taskId,
  blockedBy,
  blocking,
  canEdit,
  onChanged,
}: {
  taskId: string
  blockedBy: DependencyRef[]
  blocking: DependencyRef[]
  canEdit: boolean
  onChanged?: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [options, setOptions] = useState<DependencyRef[] | null>(null)
  const [busy, setBusy] = useState(false)

  const openBlockers = blockedBy.filter((b) => b.status !== "FILED_DONE")

  async function openPicker() {
    setAdding(true)
    if (options === null) {
      const opts = await getDependencyOptions(taskId)
      setOptions(opts)
    }
  }

  async function handleAdd(blockerId: string) {
    if (!blockerId) return
    setBusy(true)
    try {
      const res = await addTaskDependency(taskId, blockerId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Dependency added.")
      setAdding(false)
      setOptions(null) // refresh next open
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(blockerId: string) {
    setBusy(true)
    try {
      const res = await removeTaskDependency(taskId, blockerId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Dependency removed.")
      setOptions(null)
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-4 border-t border-white/[0.08] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="h-4 w-4" />
          Dependencies
          {openBlockers.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">
              <Lock className="h-3 w-3" /> blocked
            </span>
          )}
        </div>
        {canEdit && !adding && (
          <Button variant="outline" size="sm" className="h-7 gap-1 rounded-lg text-xs" onClick={() => void openPicker()}>
            <Plus className="h-3 w-3" /> Add blocker
          </Button>
        )}
      </div>

      {blockedBy.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">
          Not waiting on anything. Add a blocker to sequence this after another task.
        </p>
      )}

      {blockedBy.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Waits on</p>
          {blockedBy.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm"
            >
              <StatusDot status={b.status} />
              <span className={cn("flex-1 truncate", b.status === "FILED_DONE" && "text-muted-foreground line-through")}>
                {b.title}
              </span>
              <span className="text-[11px] text-muted-foreground">{b.status.replace(/_/g, " ")}</span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemove(b.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remove dependency on ${b.title}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-2">
          {options === null ? (
            <div className="flex h-9 flex-1 items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading open tasks…
            </div>
          ) : (
            <select
              autoFocus
              disabled={busy}
              defaultValue=""
              onChange={(e) => void handleAdd(e.target.value)}
              className="input-premium h-9 flex-1 rounded-lg bg-transparent px-3 text-sm"
            >
              <option value="" disabled>
                {options.length === 0 ? "No other open tasks for this client" : "Pick the task this one waits on…"}
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title} ({o.status.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" size="sm" className="h-9 rounded-lg text-xs" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      )}

      {blocking.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Blocks</p>
          {blocking.map((b) => (
            <div key={b.id} className="flex items-center gap-2 px-3 py-1 text-sm text-muted-foreground">
              <StatusDot status={b.status} />
              <span className="flex-1 truncate">{b.title}</span>
              <span className="text-[11px]">{b.status.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
