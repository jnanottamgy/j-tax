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
import { Textarea } from "@/components/ui/textarea"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { formatINR as formatINRCore } from "@/lib/india/format"
import {
  GST_STATE_OPTIONS,
  computeGstSplit,
  normalizeStateCode,
  stateFromGstin,
} from "@/lib/invoices/gst"
import { GST_RATES, invoiceSchema } from "@/lib/validations/invoice"

type AddInvoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  clients: Array<{
    id: string
    name: string
    gstin?: string | null
    stateCode?: string | null
  }>
  /** Firm's own GST state code — drives the CGST/SGST vs IGST preview. */
  firmState?: string | null
}

type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "DISPUTED"
  | "WAIVED"

const SERVICE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "GST_RETURN", label: "GST Return Filing" },
  { value: "INCOME_TAX", label: "Income Tax" },
  { value: "TDS", label: "TDS Compliance" },
  { value: "PAYROLL", label: "Payroll" },
  { value: "BOOKKEEPING", label: "Bookkeeping" },
  { value: "AUDIT", label: "Audit & Assurance" },
  { value: "COMPANY_LAW", label: "Company Law / ROC" },
  { value: "OTHER", label: "Other Professional Service" },
]

const defaultIssueDate = new Date().toISOString().split("T")[0]

const emptyForm = {
  clientId: "",
  serviceDescription: "",
  serviceType: "",
  professionalFee: "",
  taxRate: "18" as (typeof GST_RATES)[number],
  placeOfSupply: "",
  hsnSac: "9982",
  issueDate: defaultIssueDate,
  dueDate: "",
  status: "DRAFT" as InvoiceStatus,
  remarks: "",
}

const formatINR = (n: number) => formatINRCore(n, { paise: true })

export function AddInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  clients,
  firmState = null,
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
      fd.set("serviceDescription", data.serviceDescription)
      if (data.serviceType) fd.set("serviceType", data.serviceType)
      fd.set("professionalFee", data.professionalFee)
      fd.set("taxRate", data.taxRate)
      if (data.placeOfSupply) fd.set("placeOfSupply", data.placeOfSupply)
      fd.set("hsnSac", data.hsnSac)
      fd.set("issueDate", data.issueDate)
      fd.set("dueDate", data.dueDate)
      fd.set("status", data.status)
      fd.set("remarks", data.remarks ?? "")
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
    submit({
      ...formData,
      serviceType: formData.serviceType || undefined,
      placeOfSupply: formData.placeOfSupply || undefined,
    })
  }

  // Picking a client auto-defaults the place of supply from their GSTIN /
  // saved state code, falling back to the firm's own state (intra-state).
  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    const autoState =
      normalizeStateCode(client?.stateCode) ??
      stateFromGstin(client?.gstin) ??
      firmState ??
      ""
    setFormData((prev) => ({ ...prev, clientId, placeOfSupply: autoState }))
  }

  // Live billing breakdown: total payable = professional fee + GST
  const fee = parseFloat(formData.professionalFee) || 0
  const gst = Math.round(fee * parseFloat(formData.taxRate)) / 100
  const total = fee + gst

  // CGST/SGST vs IGST preview — only when both states are known.
  const taxRateNum = parseFloat(formData.taxRate)
  const gstSplit =
    gst > 0 && firmState && formData.placeOfSupply
      ? computeGstSplit({
          taxAmount: gst,
          firmState,
          placeOfSupply: formData.placeOfSupply,
        })
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">New Invoice</DialogTitle>
          <DialogDescription>
            Bill a client for professional services — GST is added on top of the fee.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          {formError && <FormAlert message={formError} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Client" htmlFor="clientId" required error={getError("clientId")}>
              <select
                id="clientId"
                value={formData.clientId}
                onChange={(e) => handleClientChange(e.target.value)}
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

            <FormField label="Invoice Number" htmlFor="invoiceNumber">
              <div className="input-premium flex h-10 items-center rounded-xl px-3 text-sm text-muted-foreground">
                Auto-generated on save
              </div>
            </FormField>
          </div>

          <FormField
            label="Service Description"
            htmlFor="serviceDescription"
            required
            error={getError("serviceDescription")}
          >
            <Input
              id="serviceDescription"
              value={formData.serviceDescription}
              onChange={(e) =>
                setFormData({ ...formData, serviceDescription: e.target.value })
              }
              placeholder="e.g. GST Returns — GSTR-1 & GSTR-3B for June 2026"
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
              aria-invalid={!!getError("serviceDescription")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Service Type" htmlFor="serviceType" error={getError("serviceType")}>
              <select
                id="serviceType"
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
              >
                <option value="">Select…</option>
                {SERVICE_TYPE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </FormField>

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
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Professional Fee (₹)"
              htmlFor="professionalFee"
              required
              error={getError("professionalFee")}
            >
              <Input
                id="professionalFee"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.professionalFee}
                onChange={(e) =>
                  setFormData({ ...formData, professionalFee: e.target.value })
                }
                placeholder="15000.00"
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!getError("professionalFee")}
              />
            </FormField>

            <FormField label="GST Rate" htmlFor="taxRate" error={getError("taxRate")}>
              <select
                id="taxRate"
                value={formData.taxRate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    taxRate: e.target.value as (typeof GST_RATES)[number],
                  })
                }
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%{r === "18" ? " (standard for professional services)" : ""}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Place of Supply"
              htmlFor="placeOfSupply"
              error={getError("placeOfSupply")}
            >
              <select
                id="placeOfSupply"
                value={formData.placeOfSupply}
                onChange={(e) =>
                  setFormData({ ...formData, placeOfSupply: e.target.value })
                }
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
                aria-invalid={!!getError("placeOfSupply")}
              >
                <option value="">Auto (from client GSTIN)</option>
                {GST_STATE_OPTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="HSN/SAC" htmlFor="hsnSac" error={getError("hsnSac")}>
              <Input
                id="hsnSac"
                value={formData.hsnSac}
                onChange={(e) => setFormData({ ...formData, hsnSac: e.target.value })}
                placeholder="9982"
                maxLength={8}
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!getError("hsnSac")}
              />
            </FormField>
          </div>

          {/* Live billing breakdown */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Professional Fee</span>
              <span className="tabular-nums">{formatINR(fee)}</span>
            </div>
            {gstSplit ? (
              gstSplit.igst > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST ({taxRateNum}%)</span>
                  <span className="tabular-nums">{formatINR(gstSplit.igst)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    CGST ({taxRateNum / 2}%) + SGST ({taxRateNum / 2}%)
                  </span>
                  <span className="tabular-nums">
                    {formatINR(gstSplit.cgst)} + {formatINR(gstSplit.sgst)}
                  </span>
                </div>
              )
            ) : (
              <div className="flex justify-between text-muted-foreground">
                <span>GST @ {formData.taxRate}%</span>
                <span className="tabular-nums">{formatINR(gst)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-foreground border-t border-white/[0.08] pt-1.5">
              <span>Total Payable</span>
              <span className="tabular-nums">{formatINR(total)}</span>
            </div>
          </div>

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

          <FormField label="Remarks (internal)" htmlFor="remarks" error={getError("remarks")}>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Engagement context, PO reference, special billing arrangement…"
              rows={2}
              className="input-premium rounded-xl resize-none"
              disabled={isPending}
            />
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
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
