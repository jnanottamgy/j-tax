"use client"

/**
 * Issuing a credit note against an issued invoice.
 *
 * The two things that already existed look like this and are not it. Revising
 * replaces a document the client has already been given and the return has
 * already reported. Waiving writes the invoice off whole — right for abandoning
 * a debt, wrong for a ₹5,000 reduction on a ₹50,000 bill, and it throws the GST
 * away rather than reclaiming it.
 *
 * The s.34 position is shown before the note is issued, not after: past the
 * deadline the credit note is still commercially valid but the tax cannot be
 * adjusted, and that is worth knowing while there is still a choice.
 */

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, ReceiptText } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/forms/form-field"
import { issueCreditNote } from "@/app/actions/credit-notes"
import {
  CREDIT_REASONS,
  computeCreditNote,
  taxAdjustmentStatus,
} from "@/lib/billing/credit-note"
import { formatINR } from "@/lib/india/format"

export function CreditNoteDialog({
  open,
  onOpenChange,
  invoice,
  onIssued,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: {
    id: string
    invoiceNumber: string
    issueDate: string
    amount: number
    paidAmount: number
    professionalFee?: number | null
    taxRate?: number | null
  }
  onIssued: () => void
}) {
  const [fee, setFee] = useState("")
  const [reasonCode, setReasonCode] = useState(CREDIT_REASONS[0].value)
  const [reason, setReason] = useState("")
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  const invoiceFee = invoice.professionalFee ?? invoice.amount
  const taxRate = invoice.taxRate ?? 0

  const preview = computeCreditNote({
    fee: parseFloat(fee) || 0,
    taxRate,
    invoiceFee,
    alreadyCredited: 0,
    alreadySettled: invoice.paidAmount,
    invoiceTotal: invoice.amount,
  })

  const gst = taxAdjustmentStatus(new Date(invoice.issueDate), new Date())

  async function submit() {
    setSaving(true)
    setErrors({})
    const result = await issueCreditNote({
      invoiceId: invoice.id,
      fee,
      reasonCode,
      reason,
    })
    setSaving(false)

    if (result.fieldErrors) {
      setErrors(result.fieldErrors)
      return
    }
    if (!result.success) {
      toast.error(result.error ?? "Could not issue the credit note.")
      return
    }

    toast.success(`Credit note ${result.creditNoteNumber} issued.`)
    if (result.refundDue) {
      // A client who has now overpaid is owed money back, and netting that to
      // zero silently is how a refund goes unnoticed for a year.
      toast.warning(
        `${formatINR(result.refundDue)} is now owed back to the client — they paid more than the reduced total.`
      )
    }
    setFee("")
    setReason("")
    onOpenChange(false)
    onIssued()
  }

  const err = (k: string) => errors[k]?.[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ReceiptText className="size-4 text-primary" aria-hidden />
            Credit note against {invoice.invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            Reduces an invoice that has already gone out. To write the whole
            thing off instead, use Waive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <FormField label="Amount to credit (₹, excluding GST)" htmlFor="cn-fee" required error={err("fee")}>
            <Input
              id="cn-fee"
              type="number"
              step="0.01"
              min="0"
              max={invoiceFee}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder={String(invoiceFee)}
              className="input-premium h-10 rounded-xl"
              disabled={saving}
            />
          </FormField>

          {preview.ok && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST at {taxRate}%</span>
                <span className="tabular-nums">{formatINR(preview.taxAmount)}</span>
              </div>
              <div className="mt-1.5 flex justify-between font-medium">
                <span>Total credited</span>
                <span className="tabular-nums">{formatINR(preview.amount)}</span>
              </div>
              <div className="mt-1.5 flex justify-between text-muted-foreground">
                <span>Invoice outstanding after</span>
                <span className="tabular-nums">{formatINR(preview.remainingOutstanding)}</span>
              </div>
              {preview.refundDue > 0 && (
                <p className="mt-2 text-amber-400">
                  {formatINR(preview.refundDue)} would be owed back — the client has already
                  paid more than the reduced total.
                </p>
              )}
            </div>
          )}

          <FormField label="Reason" htmlFor="cn-code" required>
            <select
              id="cn-code"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as typeof reasonCode)}
              className="input-premium h-10 w-full rounded-xl px-3 text-sm"
              disabled={saving}
            >
              {CREDIT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Note for the record" htmlFor="cn-reason" required error={err("reason")}>
            <Textarea
              id="cn-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Scope reduced after discussion with the client on 12 Aug."
              rows={2}
              className="input-premium rounded-xl"
              disabled={saving}
            />
          </FormField>

          <p className={gst.canAdjustTax ? "text-xs text-muted-foreground" : "text-xs text-amber-400"}>
            {gst.note}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !fee || !reason.trim()}>
            {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Issue credit note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
