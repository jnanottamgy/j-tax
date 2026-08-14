"use client"

import { useEffect, useState } from "react"

import {
  createInvoice,
  createRevisedInvoice,
  getClientEngagements,
  type ClientEngagement,
} from "@/app/actions/invoices"
import {
  getUnbilledTime,
  markTimeBilled,
  type UnbilledTime,
} from "@/app/actions/time-entries"
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
import { GST_UNREGISTERED, placeOfSupplyIsAssumed } from "@/lib/clients/gst-registration"
import { RecipientGstinGap } from "@/components/payments/recipient-gstin-gap"

type AddInvoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  clients: Array<{
    id: string
    name: string
    gstin?: string | null
    stateCode?: string | null
    /** "UNREGISTERED" when the firm has asked and they are genuinely not registered. */
    gstRegistration?: string | null
  }>
  /** Firm's own GST state code — drives the CGST/SGST vs IGST preview. */
  firmState?: string | null
  /** Prefill the form (task→invoice popup, or seeding a revised invoice). */
  initialValues?: Partial<{
    clientId: string
    serviceDescription: string
    serviceType: string
    professionalFee: string
    taxRate: (typeof GST_RATES)[number]
    placeOfSupply: string
    hsnSac: string
    dueDate: string
    remarks: string
  }>
  /** When set, submit creates a REVISED copy of this invoice (editable). */
  revisedFromId?: string | null
  /** When set, the created invoice is linked to the completed task. */
  sourceTaskId?: string | null
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
  { value: "INCORPORATION", label: "Incorporation" },
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
  initialValues,
  revisedFromId = null,
  sourceTaskId = null,
}: AddInvoiceDialogProps) {
  const isRevision = Boolean(revisedFromId)
  const seed = () => ({ ...emptyForm, issueDate: defaultIssueDate, ...initialValues })
  const [formData, setFormData] = useState(seed)
  // What this client is actually engaged for, and at what fee.
  const [engagements, setEngagements] = useState<ClientEngagement[]>([])
  // Billable hours logged against this client that nobody has invoiced yet.
  const [unbilled, setUnbilled] = useState<UnbilledTime | null>(null)
  // Only set when the user actually bills the hours — otherwise the entries
  // stay unbilled and show up on the next invoice, which is correct.
  const [billTime, setBillTime] = useState(false)
  // A GSTIN filled in from the warning below writes straight to the client
  // record, but the `clients` prop was rendered by the server before that. Hold
  // the answer locally so the warning clears and the place of supply corrects
  // itself immediately, instead of after a refresh.
  const [gstFix, setGstFix] = useState<{ gstin: string | null } | null>(null)

  const { submit, getError, isPending, formError, clearErrors } = useValidatedForm({
    schema: invoiceSchema,
    successMessage: isRevision ? "Revised invoice created" : "Invoice created successfully",
    onSuccess: () => {
      setFormData(seed())
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
      if (sourceTaskId) fd.set("sourceTaskId", sourceTaskId)
      const result = isRevision
        ? await createRevisedInvoice(revisedFromId!, fd)
        : await createInvoice({}, fd)

      // Stamp the hours only once the invoice exists, and only against its
      // real id — marking them first, or against a placeholder, would lose the
      // time if the invoice then failed to save.
      const invoiceId = result?.data?.invoiceId
      if (result?.success && billTime && data.clientId && typeof invoiceId === "string") {
        await markTimeBilled(data.clientId, invoiceId).catch(() => {})
      }
      return result
    },
  })

  useEffect(() => {
    if (open) {
      clearErrors()
      const fresh = seed()
      setFormData(fresh)
      // The dialog can open with a client already chosen (task → invoice, or a
      // revision), which never routes through handleClientChange — load the
      // engagements for that path too, or the fee prompt silently goes missing
      // in exactly the flow it is most useful in.
      setEngagements([])
      setUnbilled(null)
      if (fresh.clientId) {
        getClientEngagements(fresh.clientId)
          .then(setEngagements)
          .catch(() => { /* manual fee entry still works */ })
        getUnbilledTime(fresh.clientId)
          .then(setUnbilled)
          .catch(() => { /* hours are a prompt, not a requirement */ })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setEngagements([])
    setUnbilled(null)
    setGstFix(null)
    if (clientId) {
      getClientEngagements(clientId)
        .then(setEngagements)
        .catch(() => { /* the form still works with a manually typed fee */ })
      getUnbilledTime(clientId)
        .then(setUnbilled)
        .catch(() => { /* hours are a prompt, not a requirement */ })
    }
  }

  // Choosing the service pulls the fee the client actually agreed to, instead
  // of leaving the partner to remember what was quoted months ago.
  const handleServiceChange = (serviceType: string) => {
    const engagement = engagements.find((e) => e.serviceType === serviceType)
    setFormData((prev) => ({
      ...prev,
      serviceType,
      // Never overwrite a fee already typed — the agreed fee is a default,
      // not a rule, and one-off work legitimately differs.
      professionalFee:
        prev.professionalFee || (engagement?.agreedFee ? String(engagement.agreedFee) : ""),
      serviceDescription:
        prev.serviceDescription || (engagement ? `${engagement.label} — professional fees` : ""),
    }))
  }

  const activeEngagement = engagements.find((e) => e.serviceType === formData.serviceType)

  const selectedClient = clients.find((c) => c.id === formData.clientId)
  const clientGstin = gstFix ? gstFix.gstin : (selectedClient?.gstin ?? null)
  // Once a GSTIN has been saved from the warning the registration question is
  // settled; before that, whatever the client record says.
  const clientGstRegistration = gstFix
    ? gstFix.gstin
      ? null
      : GST_UNREGISTERED
    : (selectedClient?.gstRegistration ?? null)
  const placeOfSupplyAssumed =
    Boolean(selectedClient) &&
    placeOfSupplyIsAssumed({ gstin: clientGstin, stateCode: selectedClient?.stateCode }) &&
    formData.placeOfSupply === (firmState ?? "")

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
          <DialogTitle className="text-xl">{isRevision ? "Revised Invoice" : "New Invoice"}</DialogTitle>
          <DialogDescription>
            {isRevision
              ? "Edit the details and save — a new revised invoice is created; the original is kept."
              : "Bill a client for professional services — GST is added on top of the fee."}
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
                onChange={(e) => handleServiceChange(e.target.value)}
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                disabled={isPending}
              >
                <option value="">Select…</option>
                {SERVICE_TYPE_OPTIONS.map((s) => {
                  const eng = engagements.find((x) => x.serviceType === s.value)
                  return (
                    <option key={s.value} value={s.value}>
                      {s.label}
                      {eng?.agreedFee
                        ? ` — ₹${eng.agreedFee.toLocaleString("en-IN")} agreed`
                        : eng
                          ? " — engaged, no fee set"
                          : ""}
                    </option>
                  )
                })}
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

          {/* Hours logged and never priced. TimeEntry.billable existed from the
              start with no rate to multiply it by, so the timesheet measured
              cost and never touched revenue. */}
          {unbilled && unbilled.minutes > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {(unbilled.minutes / 60).toFixed(1)} unbilled hours on this client
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {unbilled.byEmployee
                      .map(
                        (e) =>
                          `${e.employeeName} ${(e.minutes / 60).toFixed(1)}h${
                            e.ratePerHour ? ` @ ₹${e.ratePerHour.toLocaleString("en-IN")}` : ""
                          }`
                      )
                      .join(" · ")}
                  </p>
                  {unbilled.hasUnratedTime && (
                    <p className="mt-1.5 text-xs text-amber-400">
                      Some of this time has no hourly rate set, so it is not included in
                      the total. Set rates on the Employees page.
                    </p>
                  )}
                </div>
                {unbilled.amount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      setBillTime(true)
                      setFormData((prev) => ({
                        ...prev,
                        professionalFee: String(unbilled.amount),
                        serviceDescription:
                          prev.serviceDescription ||
                          `Professional services — ${(unbilled.minutes / 60).toFixed(1)} hours`,
                      }))
                    }}
                  >
                    Bill {formatINR(unbilled.amount)}
                  </Button>
                )}
              </div>
              {billTime && (
                <p className="mt-3 text-xs text-emerald-400">
                  These hours will be marked billed against this invoice, so they
                  won&apos;t appear on the next one.
                </p>
              )}
            </div>
          )}

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
              {/* Billing against the agreed fee, visible at the moment it
                  matters. Under-billing a long-running engagement is otherwise
                  invisible until someone reconciles by hand at year end. */}
              {activeEngagement?.agreedFee != null && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Agreed{" "}
                  <span className="tabular-nums text-foreground">
                    ₹{activeEngagement.agreedFee.toLocaleString("en-IN")}
                  </span>{" "}
                  per {(activeEngagement.billingFrequency ?? activeEngagement.frequency).toLowerCase().replace("_", " ")}
                  {activeEngagement.invoicedToDate > 0 && (
                    <>
                      {" · "}
                      <span className="tabular-nums">
                        ₹{activeEngagement.invoicedToDate.toLocaleString("en-IN")}
                      </span>{" "}
                      invoiced to date
                    </>
                  )}
                  {fee > 0 && Math.abs(fee - activeEngagement.agreedFee) > 0.5 && (
                    <span className="text-amber-400">
                      {" "}
                      · {fee < activeEngagement.agreedFee ? "below" : "above"} the agreed fee
                    </span>
                  )}
                </p>
              )}
              {activeEngagement && activeEngagement.agreedFee == null && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  No fee agreed on this engagement yet — set it on the client so future
                  invoices default to it.
                </p>
              )}
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
              {/* With no client GSTIN and no saved state, the auto-fill above
                  used the firm's own state — which quietly makes every such
                  invoice intra-state CGST+SGST. Right for a local client,
                  wrong tax heads for anyone else. */}
              {placeOfSupplyAssumed && (
                <p className="mt-1.5 text-xs text-amber-400">
                  Assumed from your firm&apos;s state — this client has no GSTIN or state on
                  record. Confirm it before issuing.
                </p>
              )}
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

          {/* The recipient's GSTIN never blocked anything, so invoices went out
              without one and the client silently lost the input credit. Asked
              here, where it is still free to fix. */}
          {formData.clientId && selectedClient && (
            <RecipientGstinGap
              // Keyed per client so switching clients resets the half-typed
              // GSTIN and the "saved" confirmation — otherwise client B inherits
              // the answer just given for client A.
              key={formData.clientId}
              clientId={formData.clientId}
              clientName={selectedClient.name}
              gstin={clientGstin}
              gstRegistration={clientGstRegistration}
              taxAmount={gst}
              disabled={isPending}
              onResolved={(saved) => {
                setGstFix({ gstin: saved })
                // A GSTIN carries the state, so the place of supply the form
                // guessed from the firm can now be replaced with the real one.
                const state = stateFromGstin(saved)
                if (state) setFormData((prev) => ({ ...prev, placeOfSupply: state }))
              }}
            />
          )}

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
