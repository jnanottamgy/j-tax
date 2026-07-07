"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, Calculator, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  QuotationDocument,
  type QuotationDocumentFirm,
} from "@/components/proposals/quotation-document"
import { createQuotation } from "@/app/actions/proposals"
import type { getLeads } from "@/app/actions/proposals"

type Lead = Awaited<ReturnType<typeof getLeads>>[number]

// Service-based billing: each line is an engagement with a professional fee —
// there is no quantity in a tax practice.
interface ServiceItem {
  id: string
  description: string
  serviceType: string
  fee: number
  taxRate: number
}

const SERVICE_TYPES = [
  "GST Filing (Monthly)",
  "GST Filing (Quarterly)",
  "Income Tax Return",
  "TDS Filing",
  "Company Registration",
  "ROC Compliance",
  "Payroll Processing",
  "Bookkeeping",
  "Statutory Audit",
  "Internal Audit",
  "Advisory & Consultation",
  "Custom Service",
]

function newItem(): ServiceItem {
  return {
    id: Math.random().toString(36).slice(2),
    description: "",
    serviceType: "",
    fee: 0,
    taxRate: 18,
  }
}

function computeItem(item: ServiceItem) {
  const taxAmount = (item.fee * item.taxRate) / 100
  return { fee: item.fee, taxAmount, total: item.fee + taxAmount }
}

export function QuotationBuilderClient({
  leads,
  firm,
}: {
  leads: Lead[]
  firm: QuotationDocumentFirm
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultLeadId = searchParams.get("leadId") || ""

  const [items, setItems] = useState<ServiceItem[]>([newItem()])
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [defaultValidUntil] = useState<string>(() =>
    new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10)
  )

  // Live-preview fields (kept in state so the document updates as you type)
  const selectedLead = defaultLeadId ? leads.find((l) => l.id === defaultLeadId) : null
  const [clientName, setClientName] = useState(selectedLead?.name || "")
  const [clientCompany, setClientCompany] = useState(selectedLead?.company || "")
  const [clientEmail, setClientEmail] = useState(selectedLead?.email || "")
  const [clientPhone, setClientPhone] = useState(selectedLead?.phone || "")
  const [validUntil, setValidUntil] = useState(defaultValidUntil)
  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")

  const totals = items.reduce(
    (acc, item) => {
      const c = computeItem(item)
      return { subtotal: acc.subtotal + c.fee, tax: acc.tax + c.taxAmount, total: acc.total + c.total }
    },
    { subtotal: 0, tax: 0, total: 0 }
  )

  function addItem() {
    setItems((prev) => [...prev, newItem()])
  }

  function removeItem(id: string) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function updateItem(id: string, field: keyof ServiceItem, value: string | number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const incompleteItems = items.filter((i) => !i.description.trim())
    if (incompleteItems.length > 0) {
      setError("Every service needs a description.")
      return
    }

    const badFeeIdx = items.findIndex((i) => i.fee <= 0)
    if (badFeeIdx !== -1) {
      const badItem = items[badFeeIdx]
      const rowName = badItem.description.trim()
        ? `Service ${badFeeIdx + 1} (${badItem.description.trim()})`
        : `Service ${badFeeIdx + 1}`
      const msg = `${rowName} has no professional fee — enter a fee greater than ₹0.`
      setError(msg)
      toast.error(msg)
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    // The action's item shape keeps quantity for back-compat — services are
    // always quantity 1 (professional fee per engagement).
    formData.set("items", JSON.stringify(items.map((i) => ({
      description: i.description,
      serviceType: i.serviceType || undefined,
      quantity: 1,
      unitPrice: i.fee,
      taxRate: i.taxRate,
    }))))

    startTransition(async () => {
      const result = await createQuotation({}, formData)
      setIsSubmitting(false)
      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else if (result.quotationId) {
        router.push(`/proposals/quotations/${result.quotationId}`)
      }
    })
  }

  // Data for the live client-ready preview
  const previewData = {
    number: "DRAFT",
    issuedAt: new Date(),
    validUntil: validUntil ? new Date(validUntil) : new Date(),
    clientName: clientName || "Client Name",
    clientCompany: clientCompany || null,
    clientEmail: clientEmail || null,
    clientPhone: clientPhone || null,
    items: items.map((i) => {
      const c = computeItem(i)
      return {
        id: i.id,
        description: i.description,
        serviceType: i.serviceType || null,
        fee: c.fee,
        taxRate: i.taxRate,
        taxAmount: c.taxAmount,
        total: c.total,
      }
    }),
    subtotal: totals.subtotal,
    taxAmount: totals.tax,
    total: totals.total,
    notes: notes || null,
    terms: terms || null,
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-5">

          {/* Client Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Client Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {defaultLeadId && (
                <input type="hidden" name="leadId" value={defaultLeadId} />
              )}
              <div className="space-y-1.5">
                <Label htmlFor="clientName">Client Name *</Label>
                <Input
                  id="clientName"
                  name="clientName"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Rajesh Kumar"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientEmail">Email *</Label>
                <Input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="rajesh@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">Phone</Label>
                <Input
                  id="clientPhone"
                  name="clientPhone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientCompany">Company</Label>
                <Input
                  id="clientCompany"
                  name="clientCompany"
                  value={clientCompany}
                  onChange={(e) => setClientCompany(e.target.value)}
                  placeholder="ABC Enterprises Pvt Ltd"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validUntil">Valid Until *</Label>
                <Input
                  id="validUntil"
                  name="validUntil"
                  type="date"
                  required
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
              {leads.length > 0 && !defaultLeadId && (
                <div className="space-y-1.5">
                  <Label>Link to Lead (optional)</Label>
                  <Select name="leadId">
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {leads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name} {l.company ? `— ${l.company}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Professional services */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Professional Services</CardTitle>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="size-3.5 mr-1" /> Add Service
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, idx) => {
                const c = computeItem(item)
                return (
                  <div key={item.id} className="border border-white/[0.08] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Service {idx + 1}</span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove service ${idx + 1}`}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label>Service Description *</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="e.g. Monthly GST Filing — GSTR-1 & GSTR-3B (FY 2026-27)"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Service Type</Label>
                        <Select value={item.serviceType} onValueChange={(v) => updateItem(item.id, "serviceType", v)}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Professional Fee (₹) *</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.fee || ""}
                          onChange={(e) => updateItem(item.id, "fee", parseFloat(e.target.value) || 0)}
                          placeholder="15000.00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>GST Rate</Label>
                        <Select value={String(item.taxRate)} onValueChange={(v) => updateItem(item.id, "taxRate", parseFloat(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[0, 5, 12, 18, 28].map((r) => (
                              <SelectItem key={r} value={String(r)}>
                                {r}%{r === 18 ? " (standard)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end text-xs text-muted-foreground gap-4 pt-1 border-t border-white/[0.05]">
                      <span>Fee: ₹{c.fee.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <span>GST: ₹{c.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <span className="font-semibold text-foreground">Amount: ₹{c.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (shown to client)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Scope highlights, document requirements, or context for the client…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  name="terms"
                  rows={3}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="Leave blank to use the firm's standard engagement terms (shown in the preview below)…"
                />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create Quotation"}
            </Button>
          </div>
        </div>

        {/* Right: live totals */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="size-4" />
                Fee Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const c = computeItem(item)
                  return (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[160px]">
                        {item.description || `Service ${idx + 1}`}
                      </span>
                      <span className="font-medium tabular-nums">
                        ₹{c.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-white/[0.08] pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Professional Fees</span>
                  <span>₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST</span>
                  <span>₹{totals.tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-primary pt-2 border-t border-white/[0.08]">
                  <span>Total</span>
                  <span>₹{totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="rounded-lg bg-primary/8 border border-primary/15 p-3 text-xs text-muted-foreground">
                {selectedLead ? (
                  <>Creating quotation for <strong>{selectedLead.name}</strong>{selectedLead.company ? ` (${selectedLead.company})` : ""}.</>
                ) : (
                  <>Quotation will be saved as <strong>Draft</strong> or <strong>Pending Approval</strong> depending on your role.</>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Live client-ready preview */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="size-4 text-primary" aria-hidden />
          Client Preview
          <span className="text-xs font-normal text-muted-foreground">
            — updates as you type; this is the document your client receives
          </span>
        </div>
        <QuotationDocument firm={firm} quotation={previewData} />
      </div>
    </form>
  )
}
