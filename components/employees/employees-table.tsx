"use client"

import { useState } from "react"
import { Building2, Mail, Calendar, MoreVertical, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/dashboard/glass-card"
import { EmptyState } from "@/components/ui/empty-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import type { EmployeeListItem } from "@/lib/employees/types"

type EmployeesTableProps = {
  employees: EmployeeListItem[]
  canManage: boolean
  onEdit: (employee: EmployeeListItem) => void
  onDelete: (employeeId: string) => void
  onDisable: (employeeId: string) => void
  onEnable: (employeeId: string) => void
}

export function EmployeesTable({
  employees,
  canManage,
  onEdit,
  onDelete,
  onDisable,
  onEnable,
}: EmployeesTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(employees.map((e) => e.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const allSelected = employees.length > 0 && selectedIds.size === employees.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < employees.length

  if (employees.length === 0) {
    return (
      <GlassCard hover={false} className="p-12">
        <EmptyState
          icon={Building2}
          title="No employees found"
          description="Add your first team member to get started"
        />
      </GlassCard>
    )
  }

  return (
    <GlassCard hover={false} className="overflow-hidden">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 border-b border-white/[0.08] bg-white/[0.02]">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            className="border-white/[0.2]"
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} employee{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="input-premium h-8 rounded-xl border-white/[0.07] bg-transparent"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background/95 backdrop-blur">
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className="border-white/[0.2]"
                />
              </TableHead>
              <TableHead className="text-muted-foreground font-medium">Employee</TableHead>
              <TableHead className="text-muted-foreground font-medium">Department</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground font-medium">Joined</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map((employee) => (
              <TableRow
                key={employee.id}
                className="border-white/[0.06] hover:bg-white/[0.02] transition-colors"
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(employee.id)}
                    onCheckedChange={(checked) => handleSelectOne(employee.id, checked as boolean)}
                    className="border-white/[0.2]"
                  />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium">{employee.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {employee.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {employee.department ? (
                    <Badge variant="outline" className="border-white/[0.12] bg-white/[0.02]">
                      {employee.department}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      employee.isActive
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                        : "border-gray-500/25 bg-gray-500/10 text-gray-400"
                    }
                  >
                    {employee.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(employee.createdAt).toLocaleDateString()}
                  </div>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(employee)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>

                        {employee.isActive ? (
                          <DropdownMenuItem onClick={() => onDisable(employee.id)}>
                            Disable
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => onEnable(employee.id)}>
                            Enable
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          onClick={() => onDelete(employee.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  )
}
