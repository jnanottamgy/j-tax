"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Clock,
  MessageSquare,
  Receipt,
  ShieldAlert,
  Loader2,
  Plus,
  Pencil,
} from "lucide-react"

import { WhatsAppButton } from "@/components/messaging/whatsapp-button"
import { draftInvoiceReminder } from "@/lib/messaging/whatsapp-drafts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  recordPayment,
  logFollowUp,
  updateInvoiceStatus,
} from "@/app/actions/invoices"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { EditInvoiceDialog } from "@/components/payments/edit-invoice-dialog"
import { AddInvoiceDialog } from "@/components/payments/add-invoice-dialog"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { stateName } from "@/lib/invoices/gst"
import { followUpSchema, recordPaymentSchema } from "@/lib/validations/invoice"

interface Payment {
  id: string
  amount: number
  paymentDate: string
  method: string | null
  reference: string | null
}

interface FollowUp {
  id: string
  notes: string
  date: string
  followUpBy: string | null
}

interface Invoice {
  id: string
  invoiceNumber: string
  clientId: string
  amount: number
  paidAmount: number
  outstandingAmount: number
  status: string
  issueDate: string
  dueDate: string
  // Service-based billing (older invoices pre-date the fee/GST split)
  serviceDescription?: string | null
  serviceType?: string | null
  professionalFee?: number | null
  taxRate?: number | null
  taxAmount?: number | null
  // GST tax-invoice fields (null on legacy invoices → plain "GST @ x%" fallback)
  clientGstin?: string | null
  placeOfSupply?: string | null
  hsnSac?: string | null
  cgstAmount?: number | null
  sgstAmount?: number | null
  igstAmount?: number | null
  remarks?: string | null
  revisionNumber?: number
  revisedFrom?: { id: string; invoiceNumber: string; revisionNumber: number } | null
  revisions?: Array<{ id: string; invoiceNumber: string; revisionNumber: number; status: string }>
  // phone/whatsapp ride along from `include: { client: true }` — needed for the
  // WhatsApp payment reminder.
  client: {
    name: string
    gstin?: string | null
    phone?: string | null
    whatsapp?: string | null
  }
  payments: Payment[]
  followUps: FollowUp[]
}

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  OVERDUE: "destructive",
  PAID: "default",
  PARTIALLY_PAID: "secondary",
  SENT: "secondary",
  DRAFT: "outline",
  DISPUTED: "outline",
  WAIVED: "outline",
}

export function InvoiceDetailClient({
  invoice: initial,
  firmState = null,
  firmName,
}: {
  invoice: Invoice
  firmState?: string | null
  /** Signs off the WhatsApp payment-reminder draft. */
  firmName?: string
}) {
  const router = useRouter()
  const [invoice, _setInvoice] = useState(initial)

  // Edit dialog (DRAFT invoices only)
  const [editOpen, setEditOpen] = useState(false)
  // Revised-invoice dialog (non-DRAFT invoices — the "edit after sent" path)
  const [reviseOpen, setReviseOpen] = useState(false)

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentRef, setPaymentRef] = useState("")
  // Follow-up dialog
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpNotes, setFollowUpNotes] = useState("")

  // Status actions

  const paymentForm = useValidatedForm({
    schema: recordPaymentSchema,
    successMessage: "Payment recorded successfully",
    onSuccess: () => {
      setPaymentOpen(false)
      setPaymentAmount("")
      setPaymentMethod("")
      setPaymentRef("")
      router.refresh()
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("amount", data.amount)
      fd.set("method", data.method ?? "")
      fd.set("reference", data.reference ?? "")
      return recordPayment(invoice.id, {}, fd)
    },
  })

  const followUpForm = useValidatedForm({
    schema: followUpSchema,
    successMessage: "Follow-up logged",
    onSuccess: () => {
      setFollowUpOpen(false)
      setFollowUpNotes("")
      router.refresh()
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("notes", data.notes)
      return logFollowUp(invoice.id, {}, fd)
    },
  })

  const clearPaymentErrors = paymentForm.clearErrors
  const clearFollowUpErrors = followUpForm.clearErrors

  useEffect(() => {
    if (paymentOpen) clearPaymentErrors()
  }, [paymentOpen, clearPaymentErrors])

  useEffect(() => {
    if (followUpOpen) clearFollowUpErrors()
  }, [followUpOpen, clearFollowUpErrors])

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault()
    paymentForm.submit({
      amount: paymentAmount,
      method: paymentMethod,
      reference: paymentRef,
    })
  }

  const handleLogFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    followUpForm.submit({ notes: followUpNotes })
  }

  const [pendingStatus, setPendingStatus] = useState<"DISPUTED" | "WAIVED" | null>(null)

  const handleStatusChange = (status: "DISPUTED" | "WAIVED") => {
    // Confirmation happens in the themed dialog below (pending state included).
    setPendingStatus(status)
  }

  const handleStatusConfirmed = async () => {
    const status = pendingStatus
    if (!status) return
    const label = status === "DISPUTED" ? "disputed" : "waived"
    const result = await updateInvoiceStatus(invoice.id, status)
    if (result.success) {
      toast.success(`Invoice marked as ${label}`)
      router.refresh()
    } else {
      toast.error(result.error ?? `Failed to mark as ${label}`)
    }
  }

  const canAct =
    invoice.status !== "PAID" &&
    invoice.status !== "WAIVED" &&
    invoice.status !== "DISPUTED"

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/payments/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">
            Invoice {invoice.invoiceNumber}
          </h2>
          <p className="text-muted-foreground">{invoice.client.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "DRAFT" ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : (
            // Sent/issued invoices are immutable — changes go through a revision.
            <Button variant="outline" onClick={() => setReviseOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Create revised invoice
            </Button>
          )}
          {/* Chase payment on WhatsApp with the invoice details pre-written. */}
          <WhatsAppButton
            contact={invoice.client}
            message={draftInvoiceReminder({
              clientName: invoice.client.name,
              firmName,
              invoiceNumber: invoice.invoiceNumber,
              amount: Number(invoice.outstandingAmount ?? invoice.amount),
              dueDate: invoice.dueDate,
              isOverdue: invoice.status === "OVERDUE",
            })}
            label="WhatsApp reminder"
          />
          <Button
            variant="outline"
            onClick={() => setFollowUpOpen(true)}
            disabled={followUpForm.isPending}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Log Follow-up
          </Button>
          {canAct && (
            <Button onClick={() => setPaymentOpen(true)} disabled={paymentForm.isPending}>
              <Receipt className="mr-2 h-4 w-4" />
              Add Payment
            </Button>
          )}
        </div>
      </div>

      {/* Revision chain */}
      {(invoice.revisedFrom || (invoice.revisions?.length ?? 0) > 0) && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3 text-sm">
          {invoice.revisedFrom && (
            <p>
              <span className="text-muted-foreground">Revised from </span>
              <Link href={`/payments/invoices/${invoice.revisedFrom.id}`} className="font-medium text-blue-400 hover:underline">
                {invoice.revisedFrom.invoiceNumber}
              </Link>
              {(invoice.revisionNumber ?? 0) > 0 && (
                <Badge className="ml-2 border-blue-500/30 bg-blue-500/10 text-blue-400">Revision {invoice.revisionNumber}</Badge>
              )}
            </p>
          )}
          {(invoice.revisions?.length ?? 0) > 0 && (
            <p className="mt-1">
              <span className="text-muted-foreground">Revised by: </span>
              {invoice.revisions!.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <Link href={`/payments/invoices/${r.id}`} className="font-medium text-blue-400 hover:underline">
                    {r.invoiceNumber}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {/* Details + Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Engagement & Billing</CardTitle>
            {invoice.serviceDescription && (
              <CardDescription>{invoice.serviceDescription}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="mt-1">
                  <Badge variant={STATUS_VARIANT[invoice.status] ?? "outline"}>
                    {invoice.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              {invoice.serviceType && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Service Type</p>
                  <p className="mt-1 text-sm font-medium">
                    {String(invoice.serviceType).replace(/_/g, " ")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Issue Date</p>
                <p>{new Date(invoice.issueDate).toLocaleDateString("en-IN")}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                <p className="font-medium text-destructive">
                  {new Date(invoice.dueDate).toLocaleDateString("en-IN")}
                </p>
              </div>
              {invoice.clientGstin && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recipient GSTIN</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">{invoice.clientGstin}</p>
                </div>
              )}
              {invoice.placeOfSupply && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Place of Supply</p>
                  <p className="mt-1 text-sm font-medium">
                    {stateName(invoice.placeOfSupply) ?? invoice.placeOfSupply} (
                    {invoice.placeOfSupply})
                  </p>
                </div>
              )}
              {invoice.hsnSac && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">HSN/SAC</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">{invoice.hsnSac}</p>
                </div>
              )}
            </div>

            {/* Fee → GST → total breakdown (older invoices may pre-date the split) */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm space-y-1.5">
              {invoice.professionalFee !== null && invoice.professionalFee !== undefined ? (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Professional Fee</span>
                    <span className="tabular-nums">
                      ₹{Number(invoice.professionalFee).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {/* CGST/SGST (intra-state) or IGST (inter-state); legacy invoices
                      with null splits keep the plain "GST @ x%" line. */}
                  {invoice.cgstAmount != null && invoice.sgstAmount != null ? (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          CGST{invoice.taxRate != null ? ` (${Number(invoice.taxRate) / 2}%)` : ""}
                        </span>
                        <span className="tabular-nums">
                          ₹{Number(invoice.cgstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          SGST{invoice.taxRate != null ? ` (${Number(invoice.taxRate) / 2}%)` : ""}
                        </span>
                        <span className="tabular-nums">
                          ₹{Number(invoice.sgstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : invoice.igstAmount != null ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        IGST{invoice.taxRate != null ? ` (${Number(invoice.taxRate)}%)` : ""}
                      </span>
                      <span className="tabular-nums">
                        ₹{Number(invoice.igstAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-muted-foreground">
                      <span>GST{invoice.taxRate !== null ? ` @ ${Number(invoice.taxRate)}%` : ""}</span>
                      <span className="tabular-nums">
                        ₹{Number(invoice.taxAmount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </>
              ) : null}
              <div className="flex justify-between font-semibold text-base border-t border-white/[0.08] pt-1.5">
                <span>Total Payable</span>
                <span className="tabular-nums">₹{invoice.amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Paid</span>
                <span className="tabular-nums">₹{invoice.paidAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between font-bold text-destructive">
                <span>Balance Due</span>
                <span className="tabular-nums">₹{invoice.outstandingAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {invoice.remarks && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Remarks</p>
                <p className="mt-1 text-sm text-muted-foreground/90 whitespace-pre-line">
                  {invoice.remarks}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={!canAct}
              onClick={() => handleStatusChange("DISPUTED")}
            >
              <ShieldAlert className="mr-2 h-4 w-4" />
              Mark as Disputed
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground"
              disabled={!canAct}
              onClick={() => handleStatusChange("WAIVED")}
            >
              <Clock className="mr-2 h-4 w-4" />
              Waive Invoice
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Payment History + Follow-ups */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Records of all partial and full payments.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        ₹{payment.amount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.paymentDate).toLocaleDateString("en-IN")} ·{" "}
                        {payment.method ?? "No method specified"}
                      </p>
                    </div>
                    {payment.reference && (
                      <Badge variant="secondary">Ref: {payment.reference}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-ups</CardTitle>
            <CardDescription>Communication logs for this invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            {invoice.followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {invoice.followUps.map((followUp, index) => (
                  <div key={followUp.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {followUp.followUpBy ?? "System"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(followUp.date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <p className="text-sm mt-1">{followUp.notes}</p>
                    {index < invoice.followUps.length - 1 && (
                      <Separator className="my-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Outstanding: ₹{invoice.outstandingAmount.toLocaleString("en-IN")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2" noValidate>
            {paymentForm.formError && <FormAlert message={paymentForm.formError} />}
            <FormField
              label="Amount (₹)"
              htmlFor="pay-amount"
              required
              error={paymentForm.getError("amount")}
            >
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.outstandingAmount}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                className="h-10 rounded-xl"
                disabled={paymentForm.isPending}
                aria-invalid={!!paymentForm.getError("amount")}
              />
            </FormField>
            <FormField label="Payment Method" htmlFor="pay-method" error={paymentForm.getError("method")}>
              <select
                id="pay-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                disabled={paymentForm.isPending}
              >
                <option value="">Select method</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
              </select>
            </FormField>
            <FormField
              label="Reference / Transaction ID"
              htmlFor="pay-ref"
              error={paymentForm.getError("reference")}
            >
              <Input
                id="pay-ref"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="Optional reference"
                className="h-10 rounded-xl"
                disabled={paymentForm.isPending}
              />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentOpen(false)}
                disabled={paymentForm.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 btn-glow"
                disabled={paymentForm.isPending || !paymentAmount.trim()}
              >
                {paymentForm.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Record Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log Follow-up Dialog */}
      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Follow-up</DialogTitle>
            <DialogDescription>
              Record a communication or action taken for this invoice.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogFollowUp} className="space-y-4 pt-2" noValidate>
            {followUpForm.formError && <FormAlert message={followUpForm.formError} />}
            <FormField
              label="Notes"
              htmlFor="followup-notes"
              required
              error={followUpForm.getError("notes")}
            >
              <Textarea
                id="followup-notes"
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Describe the follow-up action taken..."
                rows={4}
                className="rounded-xl"
                disabled={followUpForm.isPending}
                aria-invalid={!!followUpForm.getError("notes")}
              />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setFollowUpOpen(false)}
                disabled={followUpForm.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 btn-glow"
                disabled={followUpForm.isPending || !followUpNotes.trim()}
              >
                {followUpForm.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                Log Follow-up
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={
          pendingStatus === "DISPUTED"
            ? "Mark this invoice as disputed?"
            : "Waive this invoice?"
        }
        description={
          pendingStatus === "DISPUTED"
            ? "The invoice will be flagged as disputed and excluded from normal collection flows. This cannot be undone easily."
            : "The outstanding balance will be written off. This cannot be undone easily."
        }
        confirmLabel={pendingStatus === "DISPUTED" ? "Mark as disputed" : "Waive invoice"}
        destructive
        onConfirm={handleStatusConfirmed}
      />

      <EditInvoiceDialog
        invoice={invoice}
        firmState={firmState}
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          router.refresh()
        }}
      />

      <AddInvoiceDialog
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        onSuccess={() => router.refresh()}
        clients={[{ id: invoice.clientId, name: invoice.client.name, gstin: invoice.client.gstin ?? null }]}
        firmState={firmState}
        revisedFromId={invoice.id}
        initialValues={{
          clientId: invoice.clientId,
          serviceDescription: invoice.serviceDescription ?? "",
          serviceType: invoice.serviceType ?? "",
          professionalFee: invoice.professionalFee != null ? String(invoice.professionalFee) : "",
          taxRate: (invoice.taxRate != null ? String(invoice.taxRate) : "18") as any,
          placeOfSupply: invoice.placeOfSupply ?? "",
          hsnSac: invoice.hsnSac ?? "9982",
          remarks: invoice.remarks ?? "",
        }}
      />
    </div>
  )
}
