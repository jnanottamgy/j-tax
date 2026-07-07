"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Copy, MailCheck, MailX } from "lucide-react"
import { toast } from "sonner"

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
  /** Only PARTNERs may grant/change the MANAGER role */
  viewerRole?: "PARTNER" | "MANAGER" | "EMPLOYEE" | "CLIENT"
}

type IssuedCredentials = {
  email: string
  tempPassword: string
  emailSent: boolean
}

const emptyForm = {
  name: "",
  email: "",
  department: "",
  role: "EMPLOYEE" as "EMPLOYEE" | "MANAGER",
  isActive: true,
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onSuccess,
  employee,
  isEdit = false,
  viewerRole = "MANAGER",
}: AddEmployeeDialogProps) {
  const [formData, setFormData] = useState(emptyForm)
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null)

  const { submit, getError, isPending, formError, clearErrors } = useValidatedForm({
    schema: employeeSchema,
    successMessage: isEdit ? "Employee updated successfully" : "Employee added successfully",
    onSuccess: (result) => {
      onSuccess?.()
      const data = result.data as IssuedCredentials | undefined
      if (!isEdit && data?.tempPassword) {
        // Keep the dialog open to show the one-time credentials.
        setCredentials(data)
      } else {
        onOpenChange(false)
      }
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("name", data.name)
      fd.set("email", data.email)
      fd.set("department", data.department ?? "")
      fd.set("role", data.role)
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
    setCredentials(null)
    setFormData(
      employee
        ? {
            name: employee.name,
            email: employee.email,
            department: employee.department ?? "",
            role: employee.role ?? "EMPLOYEE",
            isActive: employee.isActive,
          }
        : emptyForm
    )
  }, [open, employee, clearErrors])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  const copyPassword = async () => {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(credentials.tempPassword)
      toast.success("Temporary password copied")
    } catch {
      toast.error("Couldn't copy — select and copy the password manually.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        {credentials ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2 className="size-5 text-emerald-400" aria-hidden />
                Login created
              </DialogTitle>
              <DialogDescription>
                {credentials.emailSent
                  ? "An invite with these credentials was emailed to the new team member. Keep this password as a backup — it is shown only once."
                  : "The invite email could not be sent, so share these credentials with the new team member yourself. This password is shown only once."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Login email</span>
                  <span className="font-medium">{credentials.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Temporary password</span>
                  <span className="flex items-center gap-2">
                    <code className="rounded bg-white/[0.06] px-2 py-1 font-mono text-[13px]">
                      {credentials.tempPassword}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={copyPassword}
                      aria-label="Copy temporary password"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </span>
                </div>
              </div>

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                {credentials.emailSent ? (
                  <MailCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                ) : (
                  <MailX className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
                )}
                {credentials.emailSent
                  ? "Invite email sent."
                  : "Invite email failed (check your email settings in Settings → Firm Details)."}{" "}
                They&apos;ll be asked to choose their own password at first sign-in.
              </p>

              <Button className="h-10 w-full rounded-xl" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {isEdit ? "Edit Employee" : "Add New Employee"}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Update employee information and status."
                  : "Add a team member — they get a login and an emailed invite automatically."}
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
                  disabled={isPending || isEdit}
                  aria-invalid={!!getError("email")}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
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

                <FormField label="Role" htmlFor="role" error={getError("role")}>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value as "EMPLOYEE" | "MANAGER" })
                    }
                    className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                    disabled={isPending || viewerRole !== "PARTNER"}
                    aria-invalid={!!getError("role")}
                  >
                    <option value="EMPLOYEE">Employee</option>
                    {viewerRole === "PARTNER" && <option value="MANAGER">Manager</option>}
                  </select>
                  {viewerRole !== "PARTNER" && (
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      Only a Partner can add Managers.
                    </p>
                  )}
                </FormField>
              </div>

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
                  pendingLabel={isEdit ? "Updating..." : "Creating login..."}
                  label={isEdit ? "Update Employee" : "Add Employee"}
                  className="flex-1"
                />
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
