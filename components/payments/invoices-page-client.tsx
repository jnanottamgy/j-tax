"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Download, Eye, Plus, Receipt, Search, Trash2 } from "lucide-react"
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
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  // Quick actions elsewhere deep-link here with ?new=1 to open the dialog.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setAddDialogOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false
      if (!q) return true
      return (
        String(inv.invoiceNumber).toLowerCase().includes(q) ||
        String(inv.client?.name ?? "").toLowerCase().includes(q)
      )
    })
  }, [invoices, statusFilter, search])

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
                    <Receipt className="size-8 opacity-30" aria-hidden />
                    {invoices.length === 0 ? (
                      <>
                        <p className="font-medium text-foreground">No invoices yet</p>
                        <p className="text-sm">Create your first invoice to start tracking billing.</p>
                        <Button size="sm" className="mt-1" onClick={() => setAddDialogOpen(true)}>
                          <Plus className="mr-1.5 size-3.5" /> New Invoice
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm">No invoices match the current filters.</p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
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

  return (
    <Badge variant={variant} className={className}>
      {status.replace("_", " ")}
    </Badge>
  )
}
