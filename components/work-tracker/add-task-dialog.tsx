"use client"

import { useEffect, useState } from "react"

import { createTask } from "@/app/actions/tasks"
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
import { createTaskSchema } from "@/lib/validations/task"

type AddTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  employees: EmployeeOption[]
  clients?: Array<{ id: string; name: string }>
}

const emptyForm = {
  title: "",
  description: "",
  clientId: "",
  assignedEmployeeId: "",
  priority: "MEDIUM" as const,
  status: "NOT_STARTED" as const,
  dueDate: "",
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onSuccess,
  employees,
  clients = [],
}: AddTaskDialogProps) {
  const [formData, setFormData] = useState(emptyForm)

  const { submit, getError, isPending, formError, clearErrors } = useValidatedForm({
    schema: createTaskSchema,
    successMessage: "Task created successfully",
    onSuccess: () => {
      setFormData(emptyForm)
      onOpenChange(false)
      onSuccess?.()
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("title", data.title)
      fd.set("description", data.description ?? "")
      fd.set("clientId", data.clientId)
      fd.set("assignedEmployeeId", data.assignedEmployeeId ?? "")
      fd.set("priority", data.priority)
      fd.set("status", data.status)
      fd.set("dueDate", data.dueDate ?? "")
      return createTask({}, fd)
    },
  })

  useEffect(() => {
    if (open) {
      clearErrors()
      setFormData(emptyForm)
    }
  }, [open, clearErrors])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  const canSubmit =
    formData.title.trim().length > 0 && formData.clientId.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task to your work tracker and assign it to a team member.
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
                <option value="">Unassigned</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
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
              pendingLabel="Creating..."
              label="Create Task"
              className="flex-1"
              disabled={!canSubmit}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
