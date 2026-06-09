"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AddInvoiceDialog } from "@/components/payments/add-invoice-dialog"
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
  clients: Array<{ id: string; name: string }>
}

export function InvoicesPageClient({
  initialInvoices,
  clients,
}: InvoicesPageClientProps) {
  const router = useRouter()
  const [invoices, setInvoices] = useState(initialInvoices)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

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

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.client.name}</TableCell>
                  <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>₹{Number(invoice.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/payments/invoices/${invoice.id}`}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Link>
                    </Button>
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
