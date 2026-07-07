"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

import { updateInvoice } from "@/app/actions/invoices"
import { FormAlert } from "@/components/forms/form-alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { FormActionState } from "@/lib/forms/types"
import { formatINR as formatINRCore } from "@/lib/india/format"
import { GST_STATE_OPTIONS, computeGstSplit } from "@/lib/invoices/gst"
import { GST_RATES } from "@/lib/validations/invoice"

interface EditInvoiceDialogProps {
  invoice: {
    id: string
    invoiceNumber: string
    clientId?: string | null
    client: { name: string }
    serviceDescription?: string | null
    serviceType?: string | null
    professionalFee?: number | null
    taxRate?: number | null
    placeOfSupply?: string | null
    hsnSac?: string | null
    issueDate: string
    dueDate: string
    remarks?: string | null
  }
  open: boolean
  onClose: () => void
  /** Firm's own GST state code — drives the CGST/SGST vs IGST preview. */
  firmState?: string | null
}

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

const initialState: FormActionState = {}

const formatINR = (n: number) => formatINRCore(n, { paise: true })

function toDateInput(value: string) {
  if (!value) return ""
  const d = new Date(value)
  return isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd")
}

export function EditInvoiceDialog({
  invoice,
  open,
  onClose,
  firmState = null,
}: EditInvoiceDialogProps) {
  // Bind the invoice id so parseInvoiceFormData handles the rest of the payload.
  const [state, formAction, isPending] = useActionState(
    updateInvoice.bind(null, invoice.id),
    initialState
  )

  // Controlled state only for the fields that drive the live billing preview;
  // everything else is uncontrolled (defaultValue) like the compliance edit form.
  const [professionalFee, setProfessionalFee] = useState(
    invoice.professionalFee != null ? String(invoice.professionalFee) : ""
  )
  const [taxRate, setTaxRate] = useState<(typeof GST_RATES)[number]>(
    (invoice.taxRate != null
      ? (String(invoice.taxRate) as (typeof GST_RATES)[number])
      : "18") as (typeof GST_RATES)[number]
  )
  const [placeOfSupply, setPlaceOfSupply] = useState(invoice.placeOfSupply ?? "")

  // Re-sync the preview fields whenever a (re-)open surfaces a fresh invoice.
  useEffect(() => {
    if (open) {
      setProfessionalFee(invoice.professionalFee != null ? String(invoice.professionalFee) : "")
      setTaxRate(
        (invoice.taxRate != null
          ? (String(invoice.taxRate) as (typeof GST_RATES)[number])
          : "18") as (typeof GST_RATES)[number]
      )
      setPlaceOfSupply(invoice.placeOfSupply ?? "")
    }
  }, [open, invoice.professionalFee, invoice.taxRate, invoice.placeOfSupply])

  // Close exactly once per successful submit (fires only while the dialog is open).
  const closedRef = useRef(false)
  useEffect(() => {
    if (open) closedRef.current = false
  }, [open])
  useEffect(() => {
    if (state.success && open && !closedRef.current) {
      closedRef.current = true
      toast.success("Invoice updated")
      onClose()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, open, onClose])

  // Live billing breakdown: total payable = professional fee + GST.
  const fee = parseFloat(professionalFee) || 0
  const gst = Math.round(fee * parseFloat(taxRate)) / 100
  const total = fee + gst

  // CGST/SGST vs IGST preview — only when both states are known.
  const taxRateNum = parseFloat(taxRate)
  const gstSplit =
    gst > 0 && firmState && placeOfSupply
      ? computeGstSplit({ taxAmount: gst, firmState, placeOfSupply })
      : null

  const fieldError = (name: string) => state.fieldErrors?.[name]?.[0]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Invoice</DialogTitle>
          <DialogDescription>
            Draft invoices can be edited — GST is added on top of the professional fee.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-2">
          {state.error && <FormAlert message={state.error} />}

          {/* Identity fields are immutable — submitted (hidden) so validation
              passes, and shown read-only so it's clear they cannot change. */}
          <input type="hidden" name="clientId" value={invoice.clientId ?? ""} />
          <input type="hidden" name="invoiceNumber" value={invoice.invoiceNumber} />
          <input type="hidden" name="status" value="DRAFT" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-client" className="text-[13px]">Client</Label>
              <Input
                id="edit-client"
                value={invoice.client.name}
                disabled
                className="input-premium h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-invoiceNumber" className="text-[13px]">Invoice Number</Label>
              <Input
                id="edit-invoiceNumber"
                value={invoice.invoiceNumber}
                disabled
                className="input-premium h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-serviceDescription" className="text-[13px]">
              Service Description<span className="text-destructive"> *</span>
            </Label>
            <Input
              id="edit-serviceDescription"
              name="serviceDescription"
              defaultValue={invoice.serviceDescription ?? ""}
              placeholder="e.g. GST Returns — GSTR-1 & GSTR-3B for June 2026"
              className="input-premium h-10 rounded-xl"
              disabled={isPending}
              aria-invalid={!!fieldError("serviceDescription")}
              required
            />
            {fieldError("serviceDescription") && (
              <p className="text-xs text-destructive" role="alert">{fieldError("serviceDescription")}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-serviceType" className="text-[13px]">Service Type</Label>
              <select
                id="edit-serviceType"
                name="serviceType"
                defaultValue={invoice.serviceType ?? ""}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-professionalFee" className="text-[13px]">
                Professional Fee (₹)<span className="text-destructive"> *</span>
              </Label>
              <Input
                id="edit-professionalFee"
                name="professionalFee"
                type="number"
                step="0.01"
                min="0.01"
                value={professionalFee}
                onChange={(e) => setProfessionalFee(e.target.value)}
                placeholder="15000.00"
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!fieldError("professionalFee")}
                required
              />
              {fieldError("professionalFee") && (
                <p className="text-xs text-destructive" role="alert">{fieldError("professionalFee")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-taxRate" className="text-[13px]">GST Rate</Label>
            <select
              id="edit-taxRate"
              name="taxRate"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value as (typeof GST_RATES)[number])}
              className="input-premium h-10 w-full rounded-xl px-3 text-sm"
              disabled={isPending}
            >
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%{r === "18" ? " (standard for professional services)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-placeOfSupply" className="text-[13px]">
                Place of Supply
              </Label>
              <select
                id="edit-placeOfSupply"
                name="placeOfSupply"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
                aria-invalid={!!fieldError("placeOfSupply")}
              >
                <option value="">Auto (from client GSTIN)</option>
                {GST_STATE_OPTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              {fieldError("placeOfSupply") && (
                <p className="text-xs text-destructive" role="alert">{fieldError("placeOfSupply")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-hsnSac" className="text-[13px]">HSN/SAC</Label>
              <Input
                id="edit-hsnSac"
                name="hsnSac"
                defaultValue={invoice.hsnSac ?? "9982"}
                placeholder="9982"
                maxLength={8}
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!fieldError("hsnSac")}
              />
              {fieldError("hsnSac") && (
                <p className="text-xs text-destructive" role="alert">{fieldError("hsnSac")}</p>
              )}
            </div>
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
                <span>GST @ {taxRate}%</span>
                <span className="tabular-nums">{formatINR(gst)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-foreground border-t border-white/[0.08] pt-1.5">
              <span>Total Payable</span>
              <span className="tabular-nums">{formatINR(total)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-issueDate" className="text-[13px]">
                Issue Date<span className="text-destructive"> *</span>
              </Label>
              <Input
                id="edit-issueDate"
                name="issueDate"
                type="date"
                defaultValue={toDateInput(invoice.issueDate)}
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!fieldError("issueDate")}
                required
              />
              {fieldError("issueDate") && (
                <p className="text-xs text-destructive" role="alert">{fieldError("issueDate")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-dueDate" className="text-[13px]">
                Due Date<span className="text-destructive"> *</span>
              </Label>
              <Input
                id="edit-dueDate"
                name="dueDate"
                type="date"
                defaultValue={toDateInput(invoice.dueDate)}
                className="input-premium h-10 rounded-xl"
                disabled={isPending}
                aria-invalid={!!fieldError("dueDate")}
                required
              />
              {fieldError("dueDate") && (
                <p className="text-xs text-destructive" role="alert">{fieldError("dueDate")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-remarks" className="text-[13px]">Remarks (internal)</Label>
            <Textarea
              id="edit-remarks"
              name="remarks"
              defaultValue={invoice.remarks ?? ""}
              placeholder="Engagement context, PO reference, special billing arrangement…"
              rows={2}
              className="input-premium rounded-xl resize-none"
              disabled={isPending}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="input-premium h-10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 btn-glow h-10 rounded-xl"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
