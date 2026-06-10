"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Trash2, Calculator } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createQuotation } from "@/app/actions/proposals"
import type { getLeads } from "@/app/actions/proposals"

type Lead = Awaited<ReturnType<typeof getLeads>>[number]

interface LineItem {
  id: string
  description: string
  serviceType: string
  quantity: number
  unitPrice: number
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
  "Custom Service",
]

function newItem(): LineItem {
  return {
    id: Math.random().toString(36).slice(2),
    description: "",
    serviceType: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 18,
  }
}

function computeItem(item: LineItem) {
  const subtotal = item.quantity * item.unitPrice
  const taxAmount = (subtotal * item.taxRate) / 100
  return { subtotal, taxAmount, total: subtotal + taxAmount }
}

export function QuotationBuilderClient({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultLeadId = searchParams.get("leadId") || ""

  const [items, setItems] = useState<LineItem[]>([newItem()])
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [defaultValidUntil] = useState<string>(() =>
    new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10)
  )

  // Pre-fill from selected lead
  const selectedLead = defaultLeadId ? leads.find((l) => l.id === defaultLeadId) : null

  const totals = items.reduce(
    (acc, item) => {
      const c = computeItem(item)
      return { subtotal: acc.subtotal + c.subtotal, tax: acc.tax + c.taxAmount, total: acc.total + c.total }
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

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const incompleteItems = items.filter((i) => !i.description.trim())
    if (incompleteItems.length > 0) {
      setError("All line items must have a description.")
      return
    }

    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)
    formData.set("items", JSON.stringify(items.map((i) => ({
      description: i.description,
      serviceType: i.serviceType || undefined,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
    }))))

    startTransition(async () => {
      const result = await createQuotation({}, formData)
      setIsSubmitting(false)
      if (result.error) {
        setError(result.error)
      } else if (result.quotationId) {
        router.push(`/proposals/quotations/${result.quotationId}`)
      }
    })
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
                <Input id="clientName" name="clientName" required defaultValue={selectedLead?.name || ""} placeholder="Rajesh Kumar" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientEmail">Email *</Label>
                <Input id="clientEmail" name="clientEmail" type="email" required defaultValue={selectedLead?.email || ""} placeholder="rajesh@company.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">Phone</Label>
                <Input id="clientPhone" name="clientPhone" defaultValue={selectedLead?.phone || ""} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientCompany">Company</Label>
                <Input id="clientCompany" name="clientCompany" defaultValue={selectedLead?.company || ""} placeholder="ABC Enterprises Pvt Ltd" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validUntil">Valid Until *</Label>
                <Input
                  id="validUntil"
                  name="validUntil"
                  type="date"
                  required
                  defaultValue={defaultValidUntil}
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

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Services & Line Items</CardTitle>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="size-3.5 mr-1" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, idx) => {
                const c = computeItem(item)
                return (
                  <div key={item.id} className="border border-white/[0.08] rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="size-6" onClick={() => removeItem(item.id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label>Description *</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          placeholder="e.g. Monthly GST Filing — GSTR-1 & GSTR-3B"
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
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unit Price (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>GST Rate (%)</Label>
                        <Select value={String(item.taxRate)} onValueChange={(v) => updateItem(item.id, "taxRate", parseFloat(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[0, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end text-xs text-muted-foreground gap-4 pt-1 border-t border-white/[0.05]">
                      <span>Subtotal: ₹{c.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <span>GST: ₹{c.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <span className="font-semibold text-foreground">Total: ₹{c.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
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
                <Textarea id="notes" name="notes" rows={2} placeholder="Any special instructions or context for the client…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea id="terms" name="terms" rows={3} placeholder="Leave blank to use default terms…" />
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

        {/* Right: live summary */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="size-4" />
                Quotation Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const c = computeItem(item)
                  return (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[160px]">
                        {item.description || `Item ${idx + 1}`}
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
                  <span>Subtotal</span>
                  <span>₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST / Tax</span>
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
    </form>
  )
}
