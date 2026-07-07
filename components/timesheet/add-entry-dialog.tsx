"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  addManualEntry,
  updateTimeEntry,
  type ManualEntryInput,
  type TimesheetEntry,
  type TimesheetOptions,
} from "@/app/actions/time-entries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const NONE = "__none__"

type EntryMode = "duration" | "range"

type AddEntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: TimesheetOptions | null
  /** When set, the dialog edits this entry instead of creating a new one */
  entry?: TimesheetEntry | null
  /** yyyy-MM-dd used to prefill the date for new entries */
  defaultDate?: string
  onSaved: () => void
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function AddEntryDialog({
  open,
  onOpenChange,
  options,
  entry = null,
  defaultDate,
  onSaved,
}: AddEntryDialogProps) {
  const isEdit = entry !== null

  const [date, setDate] = useState("")
  const [mode, setMode] = useState<EntryMode>("duration")
  const [minutes, setMinutes] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [clientId, setClientId] = useState(NONE)
  const [taskId, setTaskId] = useState(NONE)
  const [description, setDescription] = useState("")
  const [billable, setBillable] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setDate(toDateInputValue(entry.startedAt))
      if (entry.endedAt) {
        setMode("range")
        setStartTime(toTimeInputValue(entry.startedAt))
        setEndTime(toTimeInputValue(entry.endedAt))
      } else {
        setMode("duration")
        setStartTime("")
        setEndTime("")
      }
      setMinutes(String(entry.minutes))
      setClientId(entry.clientId ?? NONE)
      setTaskId(entry.taskId ?? NONE)
      setDescription(entry.description ?? "")
      setBillable(entry.billable)
    } else {
      setDate(defaultDate ?? toDateInputValue(new Date().toISOString()))
      setMode("duration")
      setMinutes("")
      setStartTime("")
      setEndTime("")
      setClientId(NONE)
      setTaskId(NONE)
      setDescription("")
      setBillable(true)
    }
  }, [open, entry, defaultDate])

  const tasks = useMemo(() => {
    const all = options?.tasks ?? []
    if (clientId === NONE) return all
    return all.filter((t) => t.clientId === clientId)
  }, [options, clientId])

  const handleClientChange = (value: string) => {
    setClientId(value)
    // Drop the task if it belongs to a different client
    if (taskId !== NONE) {
      const task = options?.tasks.find((t) => t.id === taskId)
      if (task && value !== NONE && task.clientId !== value) setTaskId(NONE)
    }
  }

  const handleTaskChange = (value: string) => {
    setTaskId(value)
    if (value !== NONE) {
      const task = options?.tasks.find((t) => t.id === value)
      if (task) setClientId(task.clientId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return

    if (!date) {
      toast.error("Choose a date")
      return
    }

    const input: ManualEntryInput = {
      date,
      taskId: taskId === NONE ? undefined : taskId,
      clientId: clientId === NONE ? undefined : clientId,
      description: description.trim() || undefined,
      billable,
    }

    if (mode === "duration") {
      const parsed = Number(minutes)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 960) {
        toast.error("Duration must be between 1 and 960 minutes")
        return
      }
      input.minutes = parsed
    } else {
      if (!startTime || !endTime) {
        toast.error("Provide both start and end times")
        return
      }
      if (endTime <= startTime) {
        toast.error("End time must be after start time")
        return
      }
      input.startTime = startTime
      input.endTime = endTime
    }

    setPending(true)
    try {
      const result = isEdit
        ? await updateTimeEntry(entry!.id, input)
        : await addManualEntry(input)
      if (result.success) {
        toast.success(isEdit ? "Time entry updated" : "Time entry added")
        onOpenChange(false)
        onSaved()
      } else {
        toast.error(result.error)
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? "Edit Time Entry" : "Log Time"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the entry's duration, client, and details."
              : "Add a manual time entry to your timesheet."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Entry type</Label>
              <div className="flex h-10 items-center gap-1 rounded-xl border border-input bg-background p-1">
                {(
                  [
                    ["duration", "Duration"],
                    ["range", "Start / End"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                      mode === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {mode === "duration" ? (
            <div className="space-y-2">
              <Label htmlFor="entry-minutes">Duration (minutes)</Label>
              <Input
                id="entry-minutes"
                type="number"
                min={1}
                max={960}
                placeholder="e.g. 90"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entry-start">Start time</Label>
                <Input
                  id="entry-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry-end">End time</Label>
                <Input
                  id="entry-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={handleClientChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No client</SelectItem>
                  {(options?.clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Task (optional)</Label>
              <Select value={taskId} onValueChange={handleTaskChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No task</SelectItem>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entry-description">Description</Label>
            <Textarea
              id="entry-description"
              placeholder="What did you work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[72px] resize-none"
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5">
            <div>
              <Label htmlFor="entry-billable">Billable</Label>
              <p className="text-xs text-muted-foreground">
                Counts towards billable hours
              </p>
            </div>
            <Switch
              id="entry-billable"
              checked={billable}
              onCheckedChange={setBillable}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="btn-glow">
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Add entry"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
