"use client"

import { Building2, Mail, Calendar, KeyRound, MoreVertical, Pencil, Trash2 } from "lucide-react"

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
import type { EmployeeListItem } from "@/lib/employees/types"

type EmployeesTableProps = {
  employees: EmployeeListItem[]
  canManage: boolean
  onEdit: (employee: EmployeeListItem) => void
  onDelete: (employeeId: string) => void
  onDisable: (employeeId: string) => void
  onEnable: (employeeId: string) => void
  onResetPassword: (employee: EmployeeListItem) => void
}

export function EmployeesTable({
  employees,
  canManage,
  onEdit,
  onDelete,
  onDisable,
  onEnable,
  onResetPassword,
}: EmployeesTableProps) {
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

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background/95 backdrop-blur">
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Employee</TableHead>
              <TableHead className="text-muted-foreground font-medium">Role</TableHead>
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
                  <div className="space-y-1">
                    <p className="font-medium">{employee.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {employee.email}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {employee.role === "MANAGER" ? (
                    <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
                      Manager
                    </Badge>
                  ) : employee.role === "EMPLOYEE" ? (
                    <Badge variant="outline" className="border-white/[0.12] bg-white/[0.02]">
                      Employee
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/25 bg-amber-500/10 text-amber-400"
                      title="No login account has been created for this team member yet"
                    >
                      No login
                    </Badge>
                  )}
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

                        {employee.role && (
                          <DropdownMenuItem onClick={() => onResetPassword(employee)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Reset password
                          </DropdownMenuItem>
                        )}

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
