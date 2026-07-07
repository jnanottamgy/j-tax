"use client"

import { useState } from "react"
import { Copy, CreditCard, Landmark, MessageSquare, Smartphone } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type PaymentDetails = {
  firmName: string
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankIfsc: string | null
  upiId: string | null
}

type PayInstructionsDialogProps = {
  invoiceNumber: string
  outstandingAmount: number
  paymentDetails: PaymentDetails
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copied`)
    } catch {
      toast.error("Couldn't copy — please select and copy manually.")
    }
  }
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-medium">
        {value}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={copy}
          aria-label={`Copy ${label}`}
        >
          <Copy className="size-3.5" />
        </Button>
      </span>
    </div>
  )
}

export function PayInstructionsDialog({
  invoiceNumber,
  outstandingAmount,
  paymentDetails,
}: PayInstructionsDialogProps) {
  const [open, setOpen] = useState(false)

  const hasBank =
    paymentDetails.bankAccountNumber ||
    paymentDetails.bankAccountName ||
    paymentDetails.bankName ||
    paymentDetails.bankIfsc
  const hasUpi = !!paymentDetails.upiId
  const hasAny = hasBank || hasUpi

  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        <CreditCard className="size-3.5 mr-1" />
        Pay
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pay invoice #{invoiceNumber}</DialogTitle>
            <DialogDescription>
              Amount due:{" "}
              <strong>₹{outstandingAmount.toLocaleString("en-IN")}</strong>.
              Use any of the methods below, quoting the invoice number as
              reference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {hasBank && (
              <div className="rounded-xl border p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Landmark className="size-4 text-primary" aria-hidden />
                  Bank transfer (NEFT / IMPS / RTGS)
                </p>
                <div className="space-y-2">
                  {paymentDetails.bankName && (
                    <DetailRow label="Bank" value={paymentDetails.bankName} />
                  )}
                  {paymentDetails.bankAccountName && (
                    <DetailRow label="Account name" value={paymentDetails.bankAccountName} />
                  )}
                  {paymentDetails.bankAccountNumber && (
                    <DetailRow label="Account number" value={paymentDetails.bankAccountNumber} />
                  )}
                  {paymentDetails.bankIfsc && (
                    <DetailRow label="IFSC" value={paymentDetails.bankIfsc} />
                  )}
                </div>
              </div>
            )}

            {hasUpi && (
              <div className="rounded-xl border p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="size-4 text-primary" aria-hidden />
                  UPI
                </p>
                <DetailRow label="UPI ID" value={paymentDetails.upiId!} />
              </div>
            )}

            {!hasAny && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
                {paymentDetails.firmName} hasn&apos;t published payment details
                yet. Please message your team for payment instructions.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              After paying, your team records the payment and this invoice
              updates. Questions?{" "}
              <Link href="/client/messages" className="inline-flex items-center gap-1 underline">
                <MessageSquare className="size-3" aria-hidden />
                Message your team
              </Link>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
