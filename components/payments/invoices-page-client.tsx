"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Download, Eye, Filter, Plus, Receipt, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { deleteInvoice } from "@/app/actions/invoices"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AddInvoiceDialog } from "@/components/payments/add-invoice-dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { INVOICE_STATUS_MEANING, statusMeaning } from "@/lib/status/consequences"
import { ListEmptyState } from "@/components/ui/list-empty-state"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  DUE_WINDOW_LABELS,
  DUE_WINDOW_OPTIONS,
  matchesDueWindow,
  type DueWindow,
} from "@/lib/filters/due-window"
import { serviceLabel } from "@/lib/clients/constants"

type InvoicesPageClientProps = {
  initialInvoices: any[]
  // gstin/stateCode pass through to AddInvoiceDialog for the place-of-supply default
  clients: Array<{
    id: string
    name: string
    gstin?: string | null
    stateCode?: string | null
  }>
  firmState?: string | null
}

/** Sentinel for invoices whose client has no owner — worth filtering *to*. */
const UNASSIGNED = "__unassigned__"

const STATUS_FILTERS = [
  "ALL",
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "DISPUTED",
  "WAIVED",
] as const

export function InvoicesPageClient({
  initialInvoices,
  clients,
  firmState = null,
}: InvoicesPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role } = useAuth()
  const canDelete = role === "PARTNER" // managers can manage invoices but not delete
  const [invoices, _setInvoices] = useState(initialInvoices)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL")
  const [search, setSearch] = useState("")
  // The three slices a manager actually works in. Status describes how an
  // invoice is going; none of these do, and "whose clients owe us, due when"
  // is the question that gets asked on a Monday.
  const [ownerFilter, setOwnerFilter] = useState<string[]>([])
  const [serviceFilter, setServiceFilter] = useState<string[]>([])
  const [dueWindow, setDueWindow] = useState<DueWindow | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  // Quick actions elsewhere deep-link here with ?new=1 to open the dialog.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddDialogOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Owners and services come from the invoices themselves rather than a
  // separate query, so the dropdowns only ever offer values that would
  // actually narrow something.
  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const inv of invoices) {
      const name = inv.client?.assignedEmployeeName
      if (name) seen.set(name, name)
    }
    return [...seen.keys()].sort()
  }, [invoices])

  const serviceOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const inv of invoices) if (inv.serviceType) seen.add(inv.serviceType)
    return [...seen].sort()
  }, [invoices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    return invoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false

      if (ownerFilter.length > 0) {
        const owner = inv.client?.assignedEmployeeName ?? UNASSIGNED
        if (!ownerFilter.includes(owner)) return false
      }
      if (serviceFilter.length > 0 && !serviceFilter.includes(inv.serviceType ?? "")) {
        return false
      }
      if (dueWindow && !matchesDueWindow(inv.dueDate, dueWindow, now)) return false

      if (!q) return true
      return (
        String(inv.invoiceNumber).toLowerCase().includes(q) ||
        String(inv.client?.name ?? "").toLowerCase().includes(q)
      )
    })
  }, [invoices, statusFilter, search, ownerFilter, serviceFilter, dueWindow])

  const activeFilterLabels = [
    statusFilter !== "ALL" && `status “${statusFilter.replace(/_/g, " ").toLowerCase()}”`,
    ownerFilter.length > 0 && `owner “${ownerFilter.join(", ")}”`,
    serviceFilter.length > 0 &&
      `service “${serviceFilter.map((s) => serviceLabel(s as never)).join(", ")}”`,
    dueWindow && `due ${DUE_WINDOW_LABELS[dueWindow].toLowerCase()}`,
    search.trim() && `search “${search.trim()}”`,
  ].filter(Boolean) as string[]

  const clearFilters = () => {
    setStatusFilter("ALL")
    setSearch("")
    setOwnerFilter([])
    setServiceFilter([])
    setDueWindow(undefined)
  }

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) =>
    setter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )

  const handleDeleteConfirmed = async () => {
    const target = deleteTarget
    if (!target) return
    const result = await deleteInvoice(target.id)
    if (result.success) {
      toast.success(`Invoice ${target.invoiceNumber} deleted`)
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to delete invoice")
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">Manage and track all client invoices.</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice # or client..."
            aria-label="Search invoices"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-white/5 bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Owner, service and due window — the same three slices the clients
            list and the work tracker offer. A manager should not have to learn
            a different way to narrow each list. */}
        <div className="flex flex-wrap gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl">
                <Filter className="size-3.5" />
                Owner
                {ownerFilter.length > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">{ownerFilter.length}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuLabel>Filter by assigned employee</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={ownerFilter.includes(UNASSIGNED)}
                onCheckedChange={() => toggle(setOwnerFilter, UNASSIGNED)}
              >
                Unassigned
              </DropdownMenuCheckboxItem>
              {ownerOptions.map((name) => (
                <DropdownMenuCheckboxItem
                  key={name}
                  checked={ownerFilter.includes(name)}
                  onCheckedChange={() => toggle(setOwnerFilter, name)}
                >
                  {name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl">
                <Filter className="size-3.5" />
                Service
                {serviceFilter.length > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">{serviceFilter.length}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuLabel>Filter by service</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {serviceOptions.map((st) => (
                <DropdownMenuCheckboxItem
                  key={st}
                  checked={serviceFilter.includes(st)}
                  onCheckedChange={() => toggle(setServiceFilter, st)}
                >
                  {serviceLabel(st as never)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl">
                <Filter className="size-3.5" />
                {dueWindow ? DUE_WINDOW_LABELS[dueWindow] : "Due"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filter by due date</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {DUE_WINDOW_OPTIONS.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={dueWindow === o.value}
                  onCheckedChange={() =>
                    setDueWindow(dueWindow === o.value ? undefined : o.value)
                  }
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {activeFilterLabels.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="hidden lg:table-cell">Service</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Total (₹)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ListEmptyState
                      icon={Receipt}
                      filtered={invoices.length > 0}
                      noun="invoices"
                      emptyHint="Invoices are how work becomes revenue — raise one against a client to start tracking what is owed."
                      activeFilters={activeFilterLabels}
                      onClearFilters={clearFilters}
                      action={{ label: "New Invoice", onClick: () => setAddDialogOpen(true) }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {invoice.invoiceNumber}
                      {(invoice.revisionNumber ?? 0) > 0 && (
                        <Badge className="border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-400">
                          Rev {invoice.revisionNumber}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{invoice.client.name}</TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[220px]">
                    <span className="block truncate text-muted-foreground">
                      {invoice.serviceDescription ||
                        (invoice.serviceType
                          ? String(invoice.serviceType).replace(/_/g, " ")
                          : "—")}
                    </span>
                  </TableCell>
                  {/* Explicit locale — server/client default locales differ (hydration) */}
                  <TableCell>{new Date(invoice.issueDate).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>{new Date(invoice.dueDate).toLocaleDateString("en-IN")}</TableCell>
                  <TableCell>₹{Number(invoice.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/payments/invoices/${invoice.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View invoice {invoice.invoiceNumber}</span>
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={`/api/invoices/${invoice.id}/pdf`}
                          download
                          aria-label={`Download invoice ${invoice.invoiceNumber} as PDF`}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      {/* Delete is PARTNER-only; only unpaid, payment-free invoices (server enforces too) */}
                      {canDelete && invoice.status !== "PAID" && Number(invoice.paidAmount ?? 0) === 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(invoice)}
                          aria-label={`Delete invoice ${invoice.invoiceNumber}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AddInvoiceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => router.refresh()}
        clients={clients}
        firmState={firmState}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete invoice ${deleteTarget?.invoiceNumber ?? ""}?`}
        description="The invoice will be permanently removed. Invoices with recorded payments cannot be deleted."
        confirmLabel="Delete invoice"
        destructive
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default"
  let className = ""

  switch (status) {
    case "PAID":
      variant = "default"
      className = "bg-green-500 hover:bg-green-600"
      break
    case "PARTIALLY_PAID":
      variant = "secondary"
      className = "bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 dark:text-yellow-400"
      break
    case "OVERDUE":
      variant = "destructive"
      break
    case "DRAFT":
      variant = "outline"
      break
    case "SENT":
      variant = "secondary"
      className = "bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 dark:text-blue-400"
      break
    case "DISPUTED":
    case "WAIVED":
      variant = "outline"
      className = "text-muted-foreground"
      break
  }

  // The chip carried a colour and nothing else. DISPUTED and WAIVED both refuse
  // payments, and WAIVED also drops the amount out of the client's outstanding
  // balance — that is money given up, and it read the same as "Draft".
  const meaning = statusMeaning(INVOICE_STATUS_MEANING, status)

  return (
    <Badge variant={variant} className={className} title={meaning?.consequence}>
      {status.replace("_", " ")}
      {meaning && !meaning.automated && (
        <span
          aria-label="Not chased automatically in this status"
          className="ml-1.5 inline-block size-1.5 rounded-full bg-current opacity-60"
        />
      )}
    </Badge>
  )
}
