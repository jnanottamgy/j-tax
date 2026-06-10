"use client"

import { useEffect, useState, useTransition } from "react"
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
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { useValidatedForm } from "@/hooks/use-validated-form"
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
  amount: number
  paidAmount: number
  outstandingAmount: number
  status: string
  issueDate: string
  dueDate: string
  client: { name: string }
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

export function InvoiceDetailClient({ invoice: initial }: { invoice: Invoice }) {
  const router = useRouter()
  const [invoice, _setInvoice] = useState(initial)

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentRef, setPaymentRef] = useState("")
  // Follow-up dialog
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpNotes, setFollowUpNotes] = useState("")

  // Status actions
  const [isUpdatingStatus, startStatusUpdate] = useTransition()

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

  const handleStatusChange = (status: "DISPUTED" | "WAIVED") => {
    const label = status === "DISPUTED" ? "disputed" : "waived"
    if (!confirm(`Mark this invoice as ${label}? This cannot be undone easily.`)) return
    startStatusUpdate(async () => {
      const result = await updateInvoiceStatus(invoice.id, status)
      if (result.success) {
        toast.success(`Invoice marked as ${label}`)
        router.refresh()
      } else {
        toast.error(result.error ?? `Failed to mark as ${label}`)
      }
    })
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

      {/* Details + Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="mt-1">
                  <Badge variant={STATUS_VARIANT[invoice.status] ?? "outline"}>
                    {invoice.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">
                  ₹{invoice.amount.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paid Amount</p>
                <p className="text-lg text-emerald-400">
                  ₹{invoice.paidAmount.toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Outstanding Amount
                </p>
                <p className="text-lg font-bold text-destructive">
                  ₹{invoice.outstandingAmount.toLocaleString("en-IN")}
                </p>
              </div>
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
            </div>
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
              disabled={!canAct || isUpdatingStatus}
              onClick={() => handleStatusChange("DISPUTED")}
            >
              {isUpdatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldAlert className="mr-2 h-4 w-4" />
              )}
              Mark as Disputed
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-muted-foreground"
              disabled={!canAct || isUpdatingStatus}
              onClick={() => handleStatusChange("WAIVED")}
            >
              {isUpdatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Clock className="mr-2 h-4 w-4" />
              )}
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
    </div>
  )
}
