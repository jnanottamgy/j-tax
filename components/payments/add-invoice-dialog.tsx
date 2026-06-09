"use client"

import { useEffect, useState } from "react"

import { createInvoice } from "@/app/actions/invoices"
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
import { invoiceSchema } from "@/lib/validations/invoice"

type AddInvoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  clients: Array<{ id: string; name: string }>
}

type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "DISPUTED"
  | "WAIVED"

const defaultIssueDate = new Date().toISOString().split("T")[0]

const emptyForm = {
  clientId: "",
  invoiceNumber: "",
  amount: "",
  issueDate: defaultIssueDate,
  dueDate: "",
  status: "DRAFT" as InvoiceStatus,
}

export function AddInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  clients,
}: AddInvoiceDialogProps) {
  const [formData, setFormData] = useState(emptyForm)

  const { submit, getError, isPending, formError, clearErrors } = useValidatedForm({
    schema: invoiceSchema,
    successMessage: "Invoice created successfully",
    onSuccess: () => {
      setFormData({ ...emptyForm, issueDate: defaultIssueDate })
      onOpenChange(false)
      onSuccess?.()
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("clientId", data.clientId)
      fd.set("invoiceNumber", data.invoiceNumber)
      fd.set("amount", data.amount)
      fd.set("issueDate", data.issueDate)
      fd.set("dueDate", data.dueDate)
      fd.set("status", data.status)
      return createInvoice({}, fd)
    },
  })

  useEffect(() => {
    if (open) {
      clearErrors()
      setFormData({ ...emptyForm, issueDate: defaultIssueDate })
    }
  }, [open, clearErrors])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(formData)
  }

  const canSubmit =
    formData.clientId.length > 0 &&
    formData.invoiceNumber.trim().length > 0 &&
    formData.amount.trim().length > 0 &&
    formData.issueDate.length > 0 &&
    formData.dueDate.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Create New Invoice</DialogTitle>
          <DialogDescription>
            Generate a new invoice for a client and track payment status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          {formError && <FormAlert message={formError} />}

          <FormField label="Client" htmlFor="clientId" required error={getError("clientId")}>
            <select
              id="clientId"
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="input-premium h-10 w-full rounded-xl px-3 text-sm"
              disabled={isPending}
              aria-invalid={!!getError("clientId")}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Invoice Number"
            htmlFor="invoiceNumber"
            required
            error={getError("invoiceNumber")}
          >
            <Input
              id="invoiceNumber"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              placeholder="INV-2024-001"
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
              aria-invalid={!!getError("invoiceNumber")}
            />
          </FormField>

          <FormField label="Amount (₹)" htmlFor="amount" required error={getError("amount")}>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="5000.00"
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
              aria-invalid={!!getError("amount")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Issue Date" htmlFor="issueDate" required error={getError("issueDate")}>
              <Input
                id="issueDate"
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!getError("issueDate")}
              />
            </FormField>

            <FormField label="Due Date" htmlFor="dueDate" required error={getError("dueDate")}>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!getError("dueDate")}
              />
            </FormField>
          </div>

          <FormField label="Status" htmlFor="status" error={getError("status")}>
            <select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as InvoiceStatus })
              }
              className="input-premium h-10 w-full rounded-xl px-3 text-sm"
              disabled={isPending}
            >
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
              <option value="DISPUTED">Disputed</option>
              <option value="WAIVED">Waived</option>
            </select>
          </FormField>

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
              pendingLabel="Creating..."
              label="Create Invoice"
              className="flex-1"
              disabled={!canSubmit}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
