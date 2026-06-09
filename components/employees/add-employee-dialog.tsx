"use client"

import { useEffect, useState } from "react"

import { createEmployee, updateEmployee } from "@/app/actions/employees"
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
import { useValidatedForm } from "@/hooks/use-validated-form"
import type { EmployeeListItem } from "@/lib/employees/types"
import { employeeSchema } from "@/lib/validations/employee"

type AddEmployeeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  employee?: EmployeeListItem
  isEdit?: boolean
}

const emptyForm = {
  name: "",
  email: "",
  department: "",
  isActive: true,
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onSuccess,
  employee,
  isEdit = false,
}: AddEmployeeDialogProps) {
  const [formData, setFormData] = useState(emptyForm)

  const { submit, getError, isPending, formError, clearErrors } = useValidatedForm({
    schema: employeeSchema,
    successMessage: isEdit ? "Employee updated successfully" : "Employee added successfully",
    onSuccess: () => {
      onOpenChange(false)
      onSuccess?.()
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("name", data.name)
      fd.set("email", data.email)
      fd.set("department", data.department ?? "")
      fd.set("isActive", String(data.isActive))
      if (isEdit && employee) {
        return updateEmployee(employee.id, {}, fd)
      }
      return createEmployee({}, fd)
    },
  })

  useEffect(() => {
    if (!open) return
    clearErrors()
    setFormData(
      employee
        ? {
            name: employee.name,
            email: employee.email,
            department: employee.department ?? "",
            isActive: employee.isActive,
          }
        : emptyForm
    )
  }, [open, employee, clearErrors])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  const canSubmit =
    formData.name.trim().length >= 2 && formData.email.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? "Edit Employee" : "Add New Employee"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update employee information and status."
              : "Add a new team member to your firm."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          {formError && <FormAlert message={formError} />}

          <FormField label="Full Name" htmlFor="name" required error={getError("name")}>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
              aria-invalid={!!getError("name")}
            />
          </FormField>

          <FormField label="Email" htmlFor="email" required error={getError("email")}>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
              aria-invalid={!!getError("email")}
            />
          </FormField>

          <FormField label="Department" htmlFor="department" error={getError("department")}>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="Tax, Audit, etc."
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
            />
          </FormField>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              disabled={isPending}
              className="size-4 rounded border-white/20 accent-primary"
            />
            <label htmlFor="isActive" className="text-sm">
              Active employee
            </label>
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
              pendingLabel={isEdit ? "Updating..." : "Adding..."}
              label={isEdit ? "Update Employee" : "Add Employee"}
              className="flex-1"
              disabled={!canSubmit}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
