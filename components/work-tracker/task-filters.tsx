"use client"

import { useState } from "react"
import { Search, Filter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"

interface Employee {
  id: string
  name: string
}

interface TaskFiltersProps {
  onFiltersChange: (filters: {
    status?: string
    priority?: string
    assignedEmployeeId?: string
    search?: string
    serviceType?: string
  }) => void
  employees: Employee[]
}

export function TaskFilters({ onFiltersChange, employees }: TaskFiltersProps) {
  const [search, setSearch] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>()
  const [selectedPriority, setSelectedPriority] = useState<string | undefined>()
  const [selectedEmployee, setSelectedEmployee] = useState<string | undefined>()
  const [selectedServiceType, setSelectedServiceType] = useState<string | undefined>()

  const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
    { value: "NOT_STARTED", label: "Not Started" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "DATA_AWAITED", label: "Data Awaited" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "FILED_DONE", label: "Filed / Done" },
    { value: "ON_HOLD", label: "On Hold" },
  ]

  const PRIORITY_OPTIONS: { value: string; label: string }[] = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
  ]

  const SERVICE_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "GST_RETURN", label: "GST Return" },
    { value: "INCOME_TAX", label: "Income Tax" },
    { value: "TDS", label: "TDS" },
    { value: "PAYROLL", label: "Payroll" },
    { value: "BOOKKEEPING", label: "Bookkeeping" },
    { value: "AUDIT", label: "Audit" },
    { value: "COMPANY_LAW", label: "Company Law" },
    { value: "OTHER", label: "Other" },
  ]

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFiltersChange({
      status: selectedStatus,
      priority: selectedPriority,
      assignedEmployeeId: selectedEmployee,
      serviceType: selectedServiceType,
      search: value || undefined,
    })
  }

  const handleStatusChange = (status: string | undefined) => {
    setSelectedStatus(status)
    onFiltersChange({
      status,
      priority: selectedPriority,
      assignedEmployeeId: selectedEmployee,
      serviceType: selectedServiceType,
      search: search || undefined,
    })
  }

  const handlePriorityChange = (priority: string | undefined) => {
    setSelectedPriority(priority)
    onFiltersChange({
      status: selectedStatus,
      priority,
      assignedEmployeeId: selectedEmployee,
      serviceType: selectedServiceType,
      search: search || undefined,
    })
  }

  const handleEmployeeChange = (employeeId: string | undefined) => {
    setSelectedEmployee(employeeId)
    onFiltersChange({
      status: selectedStatus,
      priority: selectedPriority,
      assignedEmployeeId: employeeId,
      serviceType: selectedServiceType,
      search: search || undefined,
    })
  }

  const handleServiceTypeChange = (serviceType: string | undefined) => {
    setSelectedServiceType(serviceType)
    onFiltersChange({
      status: selectedStatus,
      priority: selectedPriority,
      assignedEmployeeId: selectedEmployee,
      serviceType,
      search: search || undefined,
    })
  }

  const clearAllFilters = () => {
    setSearch("")
    setSelectedStatus(undefined)
    setSelectedPriority(undefined)
    setSelectedEmployee(undefined)
    setSelectedServiceType(undefined)
    onFiltersChange({})
  }

  const hasActiveFilters = selectedStatus || selectedPriority || selectedEmployee || selectedServiceType || search

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Search */}
      <div className="relative flex-1 w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 h-10 input-premium rounded-xl"
        />
      </div>

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 rounded-xl gap-2",
              selectedStatus && "bg-primary/10 border-primary/20 text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            Status
            {selectedStatus && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleStatusChange(selectedStatus === option.value ? undefined : option.value)}
              className={cn(selectedStatus === option.value && "bg-accent")}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 rounded-xl gap-2",
              selectedPriority && "bg-primary/10 border-primary/20 text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            Priority
            {selectedPriority && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{PRIORITY_OPTIONS.find(p => p.value === selectedPriority)?.label}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handlePriorityChange(selectedPriority === option.value ? undefined : option.value)}
              className={cn(selectedPriority === option.value && "bg-accent")}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Employee Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 rounded-xl gap-2",
              selectedEmployee && "bg-primary/10 border-primary/20 text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            Assigned To
            {selectedEmployee && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{employees.find(e => e.id === selectedEmployee)?.name}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Filter by Assignee</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleEmployeeChange(undefined)}
            className={cn(!selectedEmployee && "bg-accent")}
          >
            All Employees
          </DropdownMenuItem>
          {employees.map((employee) => (
            <DropdownMenuItem
              key={employee.id}
              onClick={() => handleEmployeeChange(selectedEmployee === employee.id ? undefined : employee.id)}
              className={cn(selectedEmployee === employee.id && "bg-accent")}
            >
              {employee.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Service Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 rounded-xl gap-2",
              selectedServiceType && "bg-primary/10 border-primary/20 text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            Service Type
            {selectedServiceType && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{SERVICE_TYPE_OPTIONS.find(s => s.value === selectedServiceType)?.label}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filter by Service Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleServiceTypeChange(selectedServiceType === option.value ? undefined : option.value)}
              className={cn(selectedServiceType === option.value && "bg-accent")}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-10 rounded-xl gap-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
