"use client"

import { useEffect, useState } from "react"
import { ListChecks, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

import {
  addChecklistItem,
  deleteChecklistItem,
  getChecklist,
  toggleChecklistItem,
  type ChecklistItemRow,
} from "@/app/actions/checklists"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type TaskChecklistProps = {
  taskId: string
  canEdit: boolean
}

/**
 * Self-contained checklist block for the task drawer. Fetches its own data,
 * toggles optimistically (with rollback on server error), and lets editors
 * add/remove steps inline.
 */
export function TaskChecklist({ taskId, canEdit }: TaskChecklistProps) {
  const [items, setItems] = useState<ChecklistItemRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState("")
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setLoadError(null)

    getChecklist(taskId)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(
            e instanceof Error && e.message.includes("permission")
              ? "You do not have permission to view this checklist."
              : "Couldn't load the checklist."
          )
          setItems([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [taskId])

  const handleToggle = async (item: ChecklistItemRow) => {
    const next = !item.done
    // Optimistic flip, rollback on error
    setItems((prev) =>
      prev?.map((i) => (i.id === item.id ? { ...i, done: next } : i)) ?? prev
    )

    const result = await toggleChecklistItem(item.id, next)
    if (!result.success) {
      setItems((prev) =>
        prev?.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)) ?? prev
      )
      toast.error(result.error || "Failed to update checklist item")
    }
  }

  const handleAdd = async () => {
    const title = newTitle.trim()
    if (!title || adding) return

    setAdding(true)
    try {
      const result = await addChecklistItem(taskId, title)
      if (result.success && result.item) {
        setItems((prev) => [...(prev ?? []), result.item!])
        setNewTitle("")
      } else {
        toast.error(result.error || "Failed to add checklist step")
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (item: ChecklistItemRow) => {
    // Optimistic remove, rollback on error
    const snapshot = items
    setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev)

    const result = await deleteChecklistItem(item.id)
    if (!result.success) {
      setItems(snapshot)
      toast.error(result.error || "Failed to delete checklist step")
    }
  }

  if (items === null) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading checklist…
      </div>
    )
  }

  const doneCount = items.filter((i) => i.done).length
  const total = items.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ListChecks className="size-4 text-primary" aria-hidden />
          Checklist
        </p>
        {total > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {doneCount}/{total} done
          </span>
        )}
      </div>

      {total > 0 && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Checklist progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {loadError ? (
        <p className="py-2 text-sm text-muted-foreground">{loadError}</p>
      ) : total === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-3 py-4 text-center text-sm text-muted-foreground">
          No checklist. Add steps or start this job from a template.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
            >
              <Checkbox
                id={`checklist-${item.id}`}
                checked={item.done}
                onCheckedChange={() => handleToggle(item)}
                aria-label={item.title}
              />
              <label
                htmlFor={`checklist-${item.id}`}
                className={cn(
                  "flex-1 cursor-pointer text-sm leading-snug",
                  item.done && "text-muted-foreground line-through"
                )}
              >
                {item.title}
              </label>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => handleDelete(item)}
                  aria-label={`Delete step: ${item.title}`}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && !loadError && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleAdd()
          }}
        >
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a step…"
            className="input-premium h-9 rounded-xl"
            aria-label="New checklist step"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1 rounded-xl"
            disabled={adding}
          >
            {adding ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Plus className="size-3.5" aria-hidden />
            )}
            Add
          </Button>
        </form>
      )}
    </div>
  )
}
