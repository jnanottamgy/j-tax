"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import type { ClientPriority, ClientStatus } from "@prisma/client"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Filter,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Mail,
  UserPlus,
  Trash2,
} from "lucide-react"

import { deleteClient } from "@/app/actions/clients"
import {
  ClientPriorityBadge,
  ClientStatusBadge,
} from "@/components/clients/client-badges"
import { ClientsEmptyState } from "@/components/clients/clients-empty-state"
import { EditClientDialog } from "@/components/clients/edit-client-dialog"
import { ServiceBadgeList } from "@/components/clients/service-badges"
import { GlassCard } from "@/components/dashboard/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ALL_CLIENT_PRIORITIES,
  ALL_CLIENT_STATUSES,
  CLIENT_PRIORITY_LABELS,
  CLIENT_STATUS_LABELS,
  PAGE_SIZE,
} from "@/lib/clients/constants"
import type { ClientListItem, EmployeeOption } from "@/lib/clients/types"

type SortKey =
  | "name"
  | "code"
  | "gstin"
  | "assignedEmployee"
  | "status"
  | "priority"
  | "dueDate"

type SortDirection = "asc" | "desc"

const priorityOrder: Record<ClientPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}

const statusOrder: Record<ClientStatus, number> = {
  ACTIVE: 0,
  PENDING: 1,
  ON_HOLD: 2,
  INACTIVE: 3,
}

function SortIcon({
  column,
  sortKey,
  sortDirection,
}: {
  column: SortKey
  sortKey: SortKey | null
  sortDirection: SortDirection
}) {
  if (sortKey !== column) {
    return <ArrowUpDown className="size-3.5 opacity-40" />
  }
  return sortDirection === "asc" ? (
    <ArrowUp className="size-3.5 text-primary" />
  ) : (
    <ArrowDown className="size-3.5 text-primary" />
  )
}

function SortableHead({
  label,
  column,
  className,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string
  column: SortKey
  className?: string
  sortKey: SortKey | null
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
}) {
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase transition-colors duration-300 hover:text-foreground"
      >
        {label}
        <SortIcon
          column={column}
          sortKey={sortKey}
          sortDirection={sortDirection}
        />
      </button>
    </TableHead>
  )
}

function compareClients(
  a: ClientListItem,
  b: ClientListItem,
  key: SortKey,
  direction: SortDirection
): number {
  let result = 0

  switch (key) {
    case "name":
      result = a.name.localeCompare(b.name)
      break
    case "code":
      result = a.code.localeCompare(b.code)
      break
    case "gstin":
      result = (a.gstin ?? "").localeCompare(b.gstin ?? "")
      break
    case "assignedEmployee":
      result = a.assignedEmployee.localeCompare(b.assignedEmployee)
      break
    case "status":
      result = statusOrder[a.status] - statusOrder[b.status]
      break
    case "priority":
      result = priorityOrder[a.priority] - priorityOrder[b.priority]
      break
    case "dueDate": {
      const aTime = a.nextDueDate ? parseISO(a.nextDueDate).getTime() : Infinity
      const bTime = b.nextDueDate ? parseISO(b.nextDueDate).getTime() : Infinity
      result = aTime - bTime
      break
    }
  }

  return direction === "asc" ? result : -result
}

type ClientsTableProps = {
  clients: ClientListItem[]
  employees: EmployeeOption[]
  canManage: boolean
}

export function ClientsTable({
  clients,
  employees,
  canManage,
}: ClientsTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ClientStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<ClientPriority[]>([])
  const [sortKey, setSortKey] = useState<SortKey | null>("dueDate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [page, setPage] = useState(1)

  const hasActiveFilters =
    search.length > 0 ||
    statusFilter.length > 0 ||
    priorityFilter.length > 0

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()

    let result = clients.filter((client) => {
      const matchesSearch =
        !query ||
        client.name.toLowerCase().includes(query) ||
        client.code.toLowerCase().includes(query) ||
        (client.gstin?.toLowerCase().includes(query) ?? false) ||
        (client.pan?.toLowerCase().includes(query) ?? false) ||
        (client.email?.toLowerCase().includes(query) ?? false) ||
        client.assignedEmployee.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter.length === 0 || statusFilter.includes(client.status)

      const matchesPriority =
        priorityFilter.length === 0 ||
        priorityFilter.includes(client.priority)

      return matchesSearch && matchesStatus && matchesPriority
    })

    if (sortKey) {
      result = [...result].sort((a, b) =>
        compareClients(a, b, sortKey, sortDirection)
      )
    }

    return result
  }, [clients, search, statusFilter, priorityFilter, sortKey, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredClients.slice(start, start + PAGE_SIZE)
  }, [filteredClients, currentPage])

  const rangeStart =
    filteredClients.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredClients.length)

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
    setPage(1)
  }

  function toggleStatus(status: ClientStatus) {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    )
    setPage(1)
  }

  function togglePriority(priority: ClientPriority) {
    setPriorityFilter((prev) =>
      prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority]
    )
    setPage(1)
  }

  function clearFilters() {
    setSearch("")
    setStatusFilter([])
    setPriorityFilter([])
    setPage(1)
  }

  return (
    <GlassCard hover={false} className="glass-card-static overflow-hidden p-0">
      <div className="flex flex-col gap-5 border-b border-white/[0.05] p-5 md:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Search name, code, GSTIN, PAN, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="input-premium h-10 rounded-xl pl-10 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="input-premium h-9 gap-1.5 rounded-xl border-white/[0.07] bg-transparent"
              >
                <Filter className="size-3.5" />
                Status
                {statusFilter.length > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                    {statusFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_CLIENT_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilter.includes(status)}
                  onCheckedChange={() => toggleStatus(status)}
                >
                  {CLIENT_STATUS_LABELS[status]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="input-premium h-9 gap-1.5 rounded-xl border-white/[0.07] bg-transparent"
              >
                <SlidersHorizontal className="size-3.5" />
                Priority
                {priorityFilter.length > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">
                    {priorityFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_CLIENT_PRIORITIES.map((priority) => (
                <DropdownMenuCheckboxItem
                  key={priority}
                  checked={priorityFilter.includes(priority)}
                  onCheckedChange={() => togglePriority(priority)}
                >
                  {CLIENT_PRIORITY_LABELS[priority]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          )}
        </div>
      </div>

      {paginatedClients.length === 0 ? (
        <ClientsEmptyState
          variant={hasActiveFilters ? "no-results" : "no-clients"}
          onClearFilters={hasActiveFilters ? clearFilters : undefined}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.05] hover:bg-transparent">
                  <SortableHead
                    label="Client Name"
                    column="name"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Code"
                    column="code"
                    className="hidden sm:table-cell"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="GSTIN"
                    column="gstin"
                    className="hidden md:table-cell"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <TableHead className="hidden xl:table-cell text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Services
                  </TableHead>
                  <SortableHead
                    label="Employee"
                    column="assignedEmployee"
                    className="hidden lg:table-cell"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Status"
                    column="status"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Priority"
                    column="priority"
                    className="hidden md:table-cell"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Next Due"
                    column="dueDate"
                    className="hidden lg:table-cell"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="border-white/[0.04] transition-all duration-300 hover:bg-white/[0.035]"
                  >
                    <TableCell className="min-w-[200px] py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium leading-snug">
                          {client.name}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground sm:hidden">
                          {client.code}
                        </span>
                        {client.email && (
                          <span className="text-[11px] text-muted-foreground/80">
                            {client.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                      {client.code}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {client.gstin ?? "—"}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <ServiceBadgeList services={client.services} max={2} />
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {client.assignedEmployee}
                    </TableCell>
                    <TableCell>
                      <ClientStatusBadge status={client.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <ClientPriorityBadge priority={client.priority} />
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-sm text-muted-foreground lg:table-cell">
                      {client.nextDueDate
                        ? format(parseISO(client.nextDueDate), "MMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        client={client}
                        employees={employees}
                        canManage={canManage}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <p className="text-[13px] text-muted-foreground">
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">
                {rangeStart}–{rangeEnd}
              </span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-foreground">
                {filteredClients.length}
              </span>{" "}
              clients
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(1)}
                className="input-premium size-8 rounded-lg"
              >
                <ChevronsLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="input-premium size-8 rounded-lg"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="min-w-[4.5rem] px-2 text-center text-xs tabular-nums text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="input-premium size-8 rounded-lg"
              >
                <ChevronRight className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(totalPages)}
                className="input-premium size-8 rounded-lg"
              >
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  )
}

function RowActions({
  client,
  employees,
  canManage,
}: {
  client: ClientListItem
  employees: EmployeeOption[]
  canManage: boolean
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete "${client.name}"? This will remove all associated tasks, documents, invoices, and compliance records. This cannot be undone.`)) return
    setIsDeleting(true)
    const result = await deleteClient(client.id)
    setIsDeleting(false)
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error ?? "Failed to delete client")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
            disabled={isDeleting}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions for {client.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 border-white/[0.08] bg-popover/95 backdrop-blur-xl"
        >
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {client.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/clients/${client.id}`}>
              <Eye className="size-4" />
              View profile
            </Link>
          </DropdownMenuItem>
          {canManage && (
            <>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit client
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <UserPlus className="size-4" />
                Reassign employee
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleDelete}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="size-4" />
                Delete client
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem>
            <Mail className="size-4" />
            Send reminder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canManage && (
        <EditClientDialog
          client={client}
          employees={employees}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
