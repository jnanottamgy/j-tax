"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Download, KeyRound, MailCheck, Plus, Search } from "lucide-react"

import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog"
import { EmployeesTable } from "@/components/employees/employees-table"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  deleteEmployee,
  disableEmployee,
  enableEmployee,
  listEmployeesData,
  resetEmployeePassword,
} from "@/app/actions/employees"
import { toast } from "sonner"
import type { EmployeeListItem } from "@/lib/employees/types"

type EmployeesPageClientProps = {
  initialEmployees: EmployeeListItem[]
  canManage: boolean
  viewerRole?: "PARTNER" | "MANAGER" | "EMPLOYEE" | "CLIENT"
}

export function EmployeesPageClient({
  initialEmployees,
  canManage,
  viewerRole = "MANAGER",
}: EmployeesPageClientProps) {
  const _router = useRouter()

  const [employees, setEmployees] = useState(initialEmployees)
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all")

  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState<number>(initialEmployees.length)

  const [isLoading, setIsLoading] = useState(false)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeListItem | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const fetchEmployees = async () => {
    setIsLoading(true)
    try {
      const result = await listEmployeesData({
        query: searchQuery.trim() ? searchQuery : undefined,
        department: departmentFilter.trim() ? departmentFilter : null,
        status: statusFilter,
        page,
        pageSize,
      })

      setEmployees(result.employees)
      setTotal(result.total)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load employees")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, departmentFilter, statusFilter, page, pageSize])

  const handleEmployeeSaved = () => {
    fetchEmployees()
  }

  const [pendingAction, setPendingAction] = useState<{
    kind: "delete" | "disable"
    employeeId: string
  } | null>(null)

  // Password reset: confirm target, then reveal the one-time temp password.
  const [resetTarget, setResetTarget] = useState<EmployeeListItem | null>(null)
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null)

  const handleResetPassword = (employee: EmployeeListItem) => {
    setResetTarget(employee)
  }

  const handleResetConfirmed = async () => {
    const target = resetTarget
    if (!target) return
    const result = await resetEmployeePassword(target.id)
    if (result.success && result.tempPassword) {
      setResetResult({ email: result.email ?? target.email, tempPassword: result.tempPassword })
      toast.success("Password reset. Share the temporary password below.")
    } else {
      toast.error(result.error ?? "Failed to reset password")
    }
  }

  const copyTempPassword = async () => {
    if (!resetResult) return
    try {
      await navigator.clipboard.writeText(resetResult.tempPassword)
      toast.success("Temporary password copied")
    } catch {
      toast.error("Couldn't copy — select and copy manually.")
    }
  }

  const handleDeleteEmployee = (employeeId: string) => {
    setPendingAction({ kind: "delete", employeeId })
  }

  const handleDisableEmployee = (employeeId: string) => {
    // Disabling now also locks the person out of their login — confirm first.
    setPendingAction({ kind: "disable", employeeId })
  }

  const handleConfirmedAction = async () => {
    const action = pendingAction
    if (!action) return
    const result =
      action.kind === "delete"
        ? await deleteEmployee(action.employeeId)
        : await disableEmployee(action.employeeId)
    if (result.success) {
      toast.success(
        action.kind === "delete"
          ? "Employee deleted successfully"
          : "Employee disabled — their login is now blocked"
      )
      fetchEmployees()
    } else {
      toast.error(
        result.error ||
          (action.kind === "delete" ? "Failed to delete employee" : "Failed to disable employee")
      )
    }
  }

  const handleEnableEmployee = async (employeeId: string) => {
    const result = await enableEmployee(employeeId)
    if (result.success) {
      toast.success("Employee enabled successfully")
      fetchEmployees()
    } else {
      toast.error(result.error || "Failed to enable employee")
    }
  }

  const handleExportEmployees = () => {
    const headers = ["Name", "Email", "Department", "Status"]
    const rows = employees.map((emp) => [
      emp.name,
      emp.email,
      emp.department || "",
      emp.isActive ? "Active" : "Inactive",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `employees-${new Date().toISOString().split("T")[0]}.csv`
    )
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("Employees exported successfully")
  }

  const handleEditClick = (employee: EmployeeListItem) => {
    setEditingEmployee(employee)
    setEditDialogOpen(true)
  }

  // Keep page in range when filters change total
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  return (
    <>
      <PageHeader
        label="Team management"
        title="Employees"
        description="Manage staff roles, permissions, and workload distribution."
        action={
          <>
            <Button
              variant="outline"
              size="sm"
              className="input-premium h-9 gap-1.5 rounded-xl border-white/[0.07] bg-transparent"
              onClick={handleExportEmployees}
            >
              <Download className="size-3.5" />
              Export
            </Button>

            {canManage && (
              <Button
                size="sm"
                className="btn-glow h-9 gap-1.5 rounded-xl px-4"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="size-3.5" />
                Add employee
              </Button>
            )}
          </>
        }
      />

      <p className="-mt-2 text-[13px] text-muted-foreground/80">
        <span className="font-medium tabular-nums text-foreground/90">
          {total}
        </span>{" "}
        team {total === 1 ? "member" : "members"}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => {
              setPage(1)
              setSearchQuery(e.target.value)
            }}
            className="pl-9 h-9 rounded-xl input-premium"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="Department (exact)"
            value={departmentFilter}
            onChange={(e) => {
              setPage(1)
              setDepartmentFilter(e.target.value)
            }}
            className="h-9 rounded-xl input-premium"
          />
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1)
              setStatusFilter(
                e.target.value as "all" | "active" | "inactive"
              )
            }}
            className="h-9 rounded-xl input-premium w-full px-3"
            aria-label="Filter by status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <EmployeesTable
        employees={employees}
        canManage={canManage}
        onEdit={handleEditClick}
        onDelete={handleDeleteEmployee}
        onDisable={handleDisableEmployee}
        onEnable={handleEnableEmployee}
        onResetPassword={handleResetPassword}
      />

      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          Page <span className="font-medium">{page}</span> of{" "}
          <span className="font-medium">{totalPages}</span>
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>

          <Button
            variant="outline"
            className="rounded-xl"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      {addDialogOpen && (
        <AddEmployeeDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSuccess={handleEmployeeSaved}
          viewerRole={viewerRole}
        />
      )}

      {editDialogOpen && editingEmployee && (
        <AddEmployeeDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setEditingEmployee(null)
          }}
          onSuccess={handleEmployeeSaved}
          employee={editingEmployee}
          isEdit
          viewerRole={viewerRole}
        />
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={
          pendingAction?.kind === "delete" ? "Delete this employee?" : "Disable this employee?"
        }
        description={
          pendingAction?.kind === "delete"
            ? "The employee record will be permanently removed. Employees with assigned clients or open tasks cannot be deleted."
            : "They will be marked inactive and will no longer be able to sign in until re-enabled."
        }
        confirmLabel={pendingAction?.kind === "delete" ? "Delete employee" : "Disable"}
        destructive
        onConfirm={handleConfirmedAction}
      />

      <ConfirmDialog
        open={resetTarget !== null}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title={`Reset ${resetTarget?.name ?? ""}'s password?`}
        description="A new temporary password will be issued and they'll be required to set their own at next sign-in. Their current password stops working immediately."
        confirmLabel="Reset password"
        onConfirm={handleResetConfirmed}
      />

      {/* One-time temporary-password reveal (mirrors the create-employee flow) */}
      <Dialog open={resetResult !== null} onOpenChange={(open) => !open && setResetResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" aria-hidden />
              Temporary password
            </DialogTitle>
            <DialogDescription>
              Share this with the team member securely. It&apos;s shown only once, and
              they&apos;ll choose their own password at next sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Login email</span>
                <span className="font-medium">{resetResult?.email}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Temporary password</span>
                <span className="flex items-center gap-2">
                  <code className="rounded bg-white/[0.06] px-2 py-1 font-mono text-[13px]">
                    {resetResult?.tempPassword}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={copyTempPassword}
                    aria-label="Copy temporary password"
                  >
                    <Copy className="size-4" />
                  </Button>
                </span>
              </div>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              Send this over a secure channel — it is not emailed automatically.
            </p>
            <Button className="h-10 w-full rounded-xl" onClick={() => setResetResult(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
