"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"

import { checkTaskAssignment, createTask, updateTask } from "@/app/actions/tasks"
import type { AssignmentConcern } from "@/lib/tasks/assignment"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useValidatedForm } from "@/hooks/use-validated-form"
import type { EmployeeOption } from "@/lib/clients/types"
import { createTaskSchema, taskBaseSchema } from "@/lib/validations/task"

export type EditableTask = {
  id: string
  title: string
  description?: string | null
  assignedEmployeeId?: string | null
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"
  dueDate?: string | Date | null
}

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  employees: EmployeeOption[]
  clients?: Array<{ id: string; name: string }>
  /** When set, the dialog edits this task instead of creating a new one */
  task?: EditableTask | null
  /** Pre-select a client when opened from a deep link (?clientId=...) */
  initialClientId?: string
}

const emptyForm = {
  title: "",
  description: "",
  clientId: "",
  assignedEmployeeId: "",
  priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  status: "NOT_STARTED" as
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "DATA_AWAITED"
    | "UNDER_REVIEW"
    | "FILED_DONE"
    | "ON_HOLD",
  dueDate: "",
}

function toDateInputValue(value?: string | Date | null): string {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onSuccess,
  employees,
  clients = [],
  task = null,
  initialClientId,
}: AddTaskDialogProps) {
  const isEdit = task !== null
  const [formData, setFormData] = useState(emptyForm)

  const { submit, getError, isPending, formError, clearErrors } = useValidatedForm({
    // Edits keep their client — clientId isn't part of the update payload.
    // (Cast: the two schemas differ only by clientId, which edit mode ignores.)
    schema: (isEdit ? taskBaseSchema : createTaskSchema) as unknown as typeof createTaskSchema,
    successMessage: isEdit ? "Task updated successfully" : "Task created successfully",
    onSuccess: () => {
      setFormData(emptyForm)
      onOpenChange(false)
      onSuccess?.()
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("title", data.title)
      fd.set("description", data.description ?? "")
      fd.set("assignedEmployeeId", data.assignedEmployeeId ?? "")
      fd.set("priority", data.priority)
      fd.set("status", data.status)
      fd.set("dueDate", data.dueDate ?? "")
      if (isEdit && task) {
        fd.set("id", task.id)
        return updateTask({}, fd)
      }
      fd.set("clientId", data.clientId)
      return createTask({}, fd)
    },
  })

  useEffect(() => {
    if (!open) return
    clearErrors()
    setFormData(
      task
        ? {
            title: task.title,
            description: task.description ?? "",
            clientId: "",
            assignedEmployeeId: task.assignedEmployeeId ?? "",
            priority: task.priority,
            status: task.status,
            dueDate: toDateInputValue(task.dueDate),
          }
        : { ...emptyForm, clientId: initialClientId ?? "" }
    )
  }, [open, task, initialClientId, clearErrors])

  // Checked as the assignee and due date are chosen, so the answer arrives
  // while the choice is still open.
  const [concerns, setConcerns] = useState<AssignmentConcern[]>([])
  useEffect(() => {
    const employeeId = formData.assignedEmployeeId
    if (!employeeId) {
      setConcerns([])
      return
    }
    let cancelled = false
    checkTaskAssignment({
      employeeId,
      dueDate: formData.dueDate || null,
      taskId: task?.id,
    })
      .then((r) => { if (!cancelled) setConcerns(r.concerns) })
      .catch(() => { if (!cancelled) setConcerns([]) })
    return () => { cancelled = true }
  }, [formData.assignedEmployeeId, formData.dueDate, task?.id])

  const blocked = concerns.some((c) => c.severity === "BLOCKING")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (blocked) return
    submit(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the task's details, assignment, and schedule."
              : "Add a new task to your work tracker and assign it to a team member."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          {formError && <FormAlert message={formError} />}

          <FormField label="Task Title" htmlFor="title" required error={getError("title")}>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., GST Return Filing for Acme Corp"
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
              aria-invalid={!!getError("title")}
            />
          </FormField>

          {!isEdit && (
            <FormField label="Client" htmlFor="clientId" required error={getError("clientId")}>
              <select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
                aria-invalid={!!getError("clientId")}
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Description" htmlFor="description" error={getError("description")}>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add details about this task..."
              className="input-premium min-h-24 rounded-xl"
              disabled={isPending}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Assign To" htmlFor="assignedEmployeeId" error={getError("assignedEmployeeId")}>
              <select
                id="assignedEmployeeId"
                value={formData.assignedEmployeeId}
                onChange={(e) =>
                  setFormData({ ...formData, assignedEmployeeId: e.target.value })
                }
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
              >
                <option value="">
                  Unassigned — defaults to whoever owns the client
                </option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>

              {/* What this assignment actually lands on somebody. The capacity
                  and leave data existed; assignment consulted neither, so you
                  found out you had overloaded a person on a different page,
                  later. */}
              {concerns.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {concerns.map((c) => (
                    <li
                      key={c.kind}
                      className={
                        c.severity === "BLOCKING"
                          ? "flex items-start gap-1.5 text-xs text-red-400"
                          : "flex items-start gap-1.5 text-xs text-amber-400"
                      }
                    >
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                      {c.message}
                    </li>
                  ))}
                </ul>
              )}
            </FormField>

            <FormField label="Priority" htmlFor="priority" error={getError("priority")}>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    priority: e.target.value as typeof formData.priority,
                  })
                }
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Due Date" htmlFor="dueDate" error={getError("dueDate")}>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
              />
            </FormField>

            <FormField label="Status" htmlFor="status" error={getError("status")}>
              <select
                id="status"
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as typeof formData.status,
                  })
                }
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
              >
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DATA_AWAITED">Data Awaited</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="FILED_DONE">Filed Done</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </FormField>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="input-premium h-10 rounded-xl"
            >
              Cancel
            </Button>
            <SubmitButton
              isPending={isPending}
              pendingLabel={isEdit ? "Saving..." : "Creating..."}
              label={isEdit ? "Save Changes" : "Create Task"}
              className="flex-1"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
