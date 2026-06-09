"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Plus, Search } from "lucide-react"

import { AddEmployeeDialog } from "@/components/employees/add-employee-dialog"
import { EmployeesTable } from "@/components/employees/employees-table"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  deleteEmployee,
  disableEmployee,
  enableEmployee,
  listEmployeesData,
} from "@/app/actions/employees"
import { toast } from "sonner"
import type { EmployeeListItem } from "@/lib/employees/types"

type EmployeesPageClientProps = {
  initialEmployees: EmployeeListItem[]
  canManage: boolean
}

export function EmployeesPageClient({
  initialEmployees,
  canManage,
}: EmployeesPageClientProps) {
  const router = useRouter()

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

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return

    const result = await deleteEmployee(employeeId)
    if (result.success) {
      toast.success("Employee deleted successfully")
      fetchEmployees()
    } else {
      toast.error(result.error || "Failed to delete employee")
    }
  }

  const handleDisableEmployee = async (employeeId: string) => {
    const result = await disableEmployee(employeeId)
    if (result.success) {
      toast.success("Employee disabled successfully")
      fetchEmployees()
    } else {
      toast.error(result.error || "Failed to disable employee")
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
        />
      )}
    </>
  )
}
