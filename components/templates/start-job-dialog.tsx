"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format, isValid, parseISO, subDays } from "date-fns"
import { CalendarClock, Loader2, Play } from "lucide-react"
import { toast } from "sonner"

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
  applyJobTemplate,
  type ClientOption,
  type EmployeeOption,
  type JobTemplateListItem,
} from "@/app/actions/job-templates"

type StartJobDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: JobTemplateListItem
  clients: ClientOption[]
  employees: EmployeeOption[]
}

export function StartJobDialog({
  open,
  onOpenChange,
  template,
  clients,
  employees,
}: StartJobDialogProps) {
  const router = useRouter()

  const [clientId, setClientId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open) return
    setClientId("")
    setDueDate("")
    setAssignedEmployeeId("")
  }, [open, template.id])

  const parsedDueDate = useMemo(() => {
    if (!dueDate) return null
    const parsed = parseISO(dueDate)
    return isValid(parsed) ? parsed : null
  }, [dueDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending) return

    if (!clientId) {
      toast.error("Select a client")
      return
    }
    if (!parsedDueDate) {
      toast.error("Pick a due date")
      return
    }

    setPending(true)
    try {
      const result = await applyJobTemplate({
        templateId: template.id,
        clientId,
        dueDate,
        assignedEmployeeId: assignedEmployeeId || undefined,
      })

      if (result.success) {
        toast.success(
          `Job created with ${result.checklistCount ?? template.itemCount} checklist steps`,
          {
            action: {
              label: "Open work tracker",
              onClick: () => router.push("/work-tracker"),
            },
          }
        )
        onOpenChange(false)
      } else {
        const firstFieldError = result.fieldErrors
          ? Object.values(result.fieldErrors).flat().filter(Boolean)[0]
          : undefined
        toast.error(result.error || firstFieldError || "Failed to start job")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4 text-primary" aria-hidden />
            Start job — {template.name}
          </DialogTitle>
          <DialogDescription>
            Creates one task with {template.itemCount}{" "}
            {template.itemCount === 1 ? "checklist step" : "checklist steps"} for the
            selected client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="start-job-client">Client</Label>
            <select
              id="start-job-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-premium h-10 w-full rounded-xl px-3"
            >
              <option value="">Select a client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.clientCode})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start-job-due-date">Due date</Label>
            <Input
              id="start-job-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input-premium h-10 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="start-job-assignee">Assign to (optional)</Label>
            <select
              id="start-job-assignee"
              value={assignedEmployeeId}
              onChange={(e) => setAssignedEmployeeId(e.target.value)}
              className="input-premium h-10 w-full rounded-xl px-3"
            >
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          {parsedDueDate && template.items.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden />
                Step schedule
              </p>
              <ul className="space-y-1">
                {template.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate" title={item.title}>
                      {item.title}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {format(subDays(parsedDueDate, item.offsetDays), "d MMM yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" className="btn-glow rounded-xl" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Starting…
                </>
              ) : (
                "Start job"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
