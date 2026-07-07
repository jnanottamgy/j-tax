"use client"

/**
 * ITR computation sheet — live old-vs-new comparison.
 *
 * The pure engine (lib/tax/itr) runs in the browser on every keystroke; the
 * server recomputes from raw inputs on save, so stored results can be trusted.
 */

import { useEffect, useMemo, useState } from "react"
import { Calculator, Loader2, Printer, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { computeItr, FY_CONFIGS, type FinancialYearKey, type AgeBand, type RegimeResult } from "@/lib/tax/itr"
import { formatINR } from "@/lib/india/format"
import {
  saveItrComputation,
  listItrComputations,
  getItrComputation,
  deleteItrComputation,
  getItrClients,
  type WireItrInputs,
} from "@/app/actions/itr"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"

type ClientOption = { id: string; name: string; pan: string | null }
type SavedRow = {
  id: string
  financialYear: string
  regimeChosen: string | null
  updatedAt: string | Date
  client: { id: string; name: string; pan: string | null }
  results: unknown
}

const EMPTY: WireItrInputs = {
  fy: "2025-26",
  ageBand: "BELOW_60",
  salaryGross: 0,
  housePropertyIncome: 0,
  businessIncome: 0,
  otherSourcesIncome: 0,
  stcg111A: 0,
  ltcg112A: 0,
  ltcgOther: 0,
  deductions: { s80C: 0, s80CCD1B: 0, s80D: 0, s80G: 0, s80TTA_TTB: 0, others: 0, nps80CCD2: 0 },
  tds: 0,
  advanceTax: { q1: 0, q2: 0, q3: 0, q4: 0 },
  filingDate: null,
}

function AmountField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  hint?: string
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        inputMode="numeric"
        value={value === 0 ? "" : String(value)}
        placeholder="0"
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[₹,\s]/g, ""))
          onChange(Number.isFinite(n) ? n : 0)
        }}
        className="input-premium h-9 w-full rounded-xl bg-transparent px-3 text-right font-mono text-sm tabular-nums"
      />
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

function RegimeCard({ r, recommended }: { r: RegimeResult; recommended: boolean }) {
  const rows: Array<[string, number] | null> = [
    ["Gross total income", r.grossTotalIncome],
    r.standardDeduction ? ["− Standard deduction", -r.standardDeduction] : null,
    r.chapterVIA ? ["− Deductions", -r.chapterVIA] : null,
    ["Taxable (normal rates)", r.normalIncome],
    ["Slab tax", r.slabTax],
    r.stcg111ATax ? ["STCG 111A @20%", r.stcg111ATax] : null,
    r.ltcg112ATax ? ["LTCG 112A @12.5%", r.ltcg112ATax] : null,
    r.ltcgOtherTax ? ["LTCG 112 @12.5%", r.ltcgOtherTax] : null,
    r.rebate87A ? ["− Rebate 87A", -r.rebate87A] : null,
    r.surcharge ? ["Surcharge", r.surcharge] : null,
    ["Cess 4%", r.cess],
  ]
  return (
    <div
      className={cn(
        "surface-elevated flex-1 rounded-2xl border p-4",
        recommended ? "border-emerald-500/40" : "border-white/[0.06]"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{r.regime === "OLD" ? "Old regime" : "New regime"}</h4>
        {recommended && (
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">Recommended</Badge>
        )}
      </div>
      <div className="space-y-1 text-xs">
        {rows.filter(Boolean).map((row) => {
          const [label, amount] = row as [string, number]
          return (
            <div key={label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn("font-mono tabular-nums", amount < 0 && "text-emerald-400")}>
                {formatINR(amount)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.08] pt-3">
        <span className="text-sm font-medium">Total tax</span>
        <span className={cn("font-mono text-lg font-semibold tabular-nums", recommended && "text-emerald-400")}>
          {formatINR(r.totalTax)}
        </span>
      </div>
    </div>
  )
}

export function ItrClient() {
  const { role } = useAuth()
  const canDelete = role === "PARTNER" || role === "MANAGER"
  const [clients, setClients] = useState<ClientOption[]>([])
  const [saved, setSaved] = useState<SavedRow[]>([])
  const [clientId, setClientId] = useState("")
  const [inputs, setInputs] = useState<WireItrInputs>(EMPTY)
  const [computationId, setComputationId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const [cs, rows] = await Promise.all([getItrClients(), listItrComputations()])
      setClients(cs)
      setSaved(rows as unknown as SavedRow[])
      if (cs[0]) setClientId(cs[0].id)
    })()
  }, [])

  const result = useMemo(() => {
    try {
      return computeItr({
        ...inputs,
        filingDate: inputs.filingDate ? new Date(inputs.filingDate) : undefined,
      })
    } catch {
      return null
    }
  }, [inputs])

  const set = (patch: Partial<WireItrInputs>) => setInputs((s) => ({ ...s, ...patch }))
  const setD = (patch: Partial<WireItrInputs["deductions"]>) =>
    setInputs((s) => ({ ...s, deductions: { ...s.deductions, ...patch } }))
  const setA = (patch: Partial<WireItrInputs["advanceTax"]>) =>
    setInputs((s) => ({ ...s, advanceTax: { ...s.advanceTax, ...patch } }))

  async function handleSave() {
    if (!clientId) {
      toast.error("Pick a client first.")
      return
    }
    setSaving(true)
    try {
      const res = await saveItrComputation({
        clientId,
        inputs,
        computationId: computationId ?? undefined,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setComputationId(res.id)
      setSaved((await listItrComputations()) as unknown as SavedRow[])
      toast.success(computationId ? "Computation updated." : "Computation saved.")
    } finally {
      setSaving(false)
    }
  }

  async function openSaved(id: string) {
    const row = await getItrComputation(id)
    if (!row) {
      toast.error("Not found.")
      return
    }
    setClientId(row.clientId)
    setInputs(row.inputs as unknown as WireItrInputs)
    setComputationId(row.id)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleDelete(id: string) {
    const res = await deleteItrComputation(id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    if (computationId === id) setComputationId(null)
    setSaved((await listItrComputations()) as unknown as SavedRow[])
    toast.success("Deleted.")
  }

  function handlePrint() {
    if (!result) return
    const client = clients.find((c) => c.id === clientId)
    const fy = FY_CONFIGS[inputs.fy]
    const line = (label: string, v: number, strong = false) =>
      `<tr><td style="padding:4px 8px;${strong ? "font-weight:600" : ""}">${label}</td><td style="padding:4px 8px;text-align:right;font-family:monospace;${strong ? "font-weight:600" : ""}">${formatINR(v)}</td></tr>`
    const regimeBlock = (r: RegimeResult) => `
      <h3 style="margin:16px 0 4px">${r.regime === "OLD" ? "Old" : "New"} regime ${result.recommended === r.regime ? "★ (recommended)" : ""}</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd">
        ${line("Gross total income", r.grossTotalIncome)}
        ${r.standardDeduction ? line("Less: standard deduction", -r.standardDeduction) : ""}
        ${r.chapterVIA ? line("Less: deductions", -r.chapterVIA) : ""}
        ${line("Taxable income (normal rates)", r.normalIncome)}
        ${line("Tax on slabs", r.slabTax)}
        ${r.stcg111ATax ? line("STCG u/s 111A @20%", r.stcg111ATax) : ""}
        ${r.ltcg112ATax ? line("LTCG u/s 112A @12.5%", r.ltcg112ATax) : ""}
        ${r.ltcgOtherTax ? line("LTCG u/s 112 @12.5%", r.ltcgOtherTax) : ""}
        ${r.rebate87A ? line("Less: rebate u/s 87A", -r.rebate87A) : ""}
        ${r.surcharge ? line("Surcharge", r.surcharge) : ""}
        ${line("Health & education cess @4%", r.cess)}
        ${line("Total tax liability", r.totalTax, true)}
      </table>`
    const html = `<!doctype html><html><head><title>ITR Computation — ${client?.name ?? ""}</title></head>
      <body style="font-family:Arial,sans-serif;max-width:720px;margin:24px auto;color:#111">
        <h2 style="margin:0">Income Tax Computation</h2>
        <p style="margin:4px 0;color:#555">${client?.name ?? "—"}${client?.pan ? ` · PAN ${client.pan}` : ""} · ${fy.label} (${fy.assessmentYear})</p>
        ${regimeBlock(result.old)}
        ${regimeBlock(result.new)}
        <h3 style="margin:16px 0 4px">Taxes paid & interest (${result.recommended === "OLD" ? "old" : "new"} regime)</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #ddd">
          ${line("TDS + advance tax paid", result.totalPrepaid)}
          ${result.interest.i234A ? line("Interest u/s 234A", result.interest.i234A) : ""}
          ${result.interest.i234B ? line("Interest u/s 234B", result.interest.i234B) : ""}
          ${result.interest.i234C ? line("Interest u/s 234C", result.interest.i234C) : ""}
          ${line(result.netPayable >= 0 ? "Net tax payable" : "Refund due", Math.abs(result.netPayable), true)}
        </table>
        <p style="margin-top:24px;font-size:11px;color:#777">Computed by J-TACS on ${new Date().toLocaleDateString("en-IN")}. Verify before filing.</p>
      </body></html>`
    const w = window.open("", "_blank", "width=800,height=900")
    if (!w) {
      toast.error("Allow pop-ups to print the computation sheet.")
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  const fyCfg = FY_CONFIGS[inputs.fy]

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      {/* ── Inputs ── */}
      <div className="space-y-4">
        <div className="surface-elevated space-y-3 rounded-2xl border border-white/[0.06] p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Client</span>
              <select
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setComputationId(null) }}
                className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Financial year</span>
              <select
                value={inputs.fy}
                onChange={(e) => set({ fy: e.target.value as FinancialYearKey })}
                className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm"
              >
                {(Object.keys(FY_CONFIGS) as FinancialYearKey[]).map((k) => (
                  <option key={k} value={k}>{FY_CONFIGS[k].label} ({FY_CONFIGS[k].assessmentYear})</option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Age band (old-regime exemption)</span>
            <select
              value={inputs.ageBand}
              onChange={(e) => set({ ageBand: e.target.value as AgeBand })}
              className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm"
            >
              <option value="BELOW_60">Below 60 / HUF</option>
              <option value="SENIOR_60_79">Senior (60–79)</option>
              <option value="SUPER_SENIOR_80_PLUS">Super senior (80+)</option>
            </select>
          </label>
        </div>

        <div className="surface-elevated space-y-3 rounded-2xl border border-white/[0.06] p-4">
          <h4 className="text-sm font-semibold">Income</h4>
          <div className="grid grid-cols-2 gap-3">
            <AmountField label="Salary (gross)" value={inputs.salaryGross} onChange={(n) => set({ salaryGross: n })} hint={`Std deduction auto: ₹50k old / ₹${fyCfg.new.standardDeduction / 1000}k new`} />
            <AmountField label="House property (net)" value={inputs.housePropertyIncome} onChange={(n) => set({ housePropertyIncome: n })} hint="Negative = loss (capped ₹2L old)" />
            <AmountField label="Business / profession" value={inputs.businessIncome} onChange={(n) => set({ businessIncome: n })} />
            <AmountField label="Other sources" value={inputs.otherSourcesIncome} onChange={(n) => set({ otherSourcesIncome: n })} />
            <AmountField label="STCG 111A (equity)" value={inputs.stcg111A} onChange={(n) => set({ stcg111A: n })} hint="@20%" />
            <AmountField label="LTCG 112A (equity)" value={inputs.ltcg112A} onChange={(n) => set({ ltcg112A: n })} hint="₹1.25L exempt, then 12.5%" />
            <AmountField label="Other LTCG (112)" value={inputs.ltcgOther} onChange={(n) => set({ ltcgOther: n })} hint="@12.5%" />
          </div>
        </div>

        <div className="surface-elevated space-y-3 rounded-2xl border border-white/[0.06] p-4">
          <h4 className="text-sm font-semibold">Deductions <span className="font-normal text-muted-foreground">(old regime, except NPS employer)</span></h4>
          <div className="grid grid-cols-2 gap-3">
            <AmountField label="80C basket" value={inputs.deductions.s80C} onChange={(n) => setD({ s80C: n })} hint="cap ₹1.5L" />
            <AmountField label="80CCD(1B) NPS self" value={inputs.deductions.s80CCD1B} onChange={(n) => setD({ s80CCD1B: n })} hint="cap ₹50k" />
            <AmountField label="80D medical" value={inputs.deductions.s80D} onChange={(n) => setD({ s80D: n })} />
            <AmountField label="80G donations" value={inputs.deductions.s80G} onChange={(n) => setD({ s80G: n })} />
            <AmountField label="80TTA / 80TTB" value={inputs.deductions.s80TTA_TTB} onChange={(n) => setD({ s80TTA_TTB: n })} />
            <AmountField label="Others (HRA etc.)" value={inputs.deductions.others} onChange={(n) => setD({ others: n })} />
            <AmountField label="80CCD(2) NPS employer" value={inputs.deductions.nps80CCD2} onChange={(n) => setD({ nps80CCD2: n })} hint="allowed in BOTH regimes" />
          </div>
        </div>

        <div className="surface-elevated space-y-3 rounded-2xl border border-white/[0.06] p-4">
          <h4 className="text-sm font-semibold">Taxes paid</h4>
          <div className="grid grid-cols-2 gap-3">
            <AmountField label="TDS / TCS" value={inputs.tds} onChange={(n) => set({ tds: n })} />
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Filing date (for 234A/B)</span>
              <input
                type="date"
                value={inputs.filingDate ? String(inputs.filingDate).slice(0, 10) : ""}
                onChange={(e) => set({ filingDate: e.target.value || null })}
                className="input-premium h-9 w-full rounded-xl bg-transparent px-3 text-sm"
              />
            </label>
            <AmountField label="Advance by 15 Jun" value={inputs.advanceTax.q1} onChange={(n) => setA({ q1: n })} />
            <AmountField label="by 15 Sep" value={inputs.advanceTax.q2} onChange={(n) => setA({ q2: n })} />
            <AmountField label="by 15 Dec" value={inputs.advanceTax.q3} onChange={(n) => setA({ q3: n })} />
            <AmountField label="by 15 Mar" value={inputs.advanceTax.q4} onChange={(n) => setA({ q4: n })} />
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="space-y-4">
        {result && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row">
              <RegimeCard r={result.old} recommended={result.recommended === "OLD"} />
              <RegimeCard r={result.new} recommended={result.recommended === "NEW"} />
            </div>

            <div className="surface-elevated rounded-2xl border border-white/[0.06] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm">
                    <span className="font-semibold text-emerald-400">
                      {result.recommended === "NEW" ? "New" : "Old"} regime saves {formatINR(result.savings)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Prepaid {formatINR(result.totalPrepaid)}
                    {result.interest.total > 0 && (
                      <> · Interest 234A {formatINR(result.interest.i234A)} / 234B {formatINR(result.interest.i234B)} / 234C {formatINR(result.interest.i234C)}</>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{result.netPayable >= 0 ? "Net payable" : "Refund due"}</p>
                  <p className={cn("font-mono text-2xl font-semibold tabular-nums", result.netPayable >= 0 ? "text-amber-400" : "text-emerald-400")}>
                    {formatINR(Math.abs(result.netPayable))}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="btn-glow gap-1.5 rounded-xl" disabled={saving || !clientId} onClick={() => void handleSave()}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {computationId ? "Update computation" : "Save computation"}
                </Button>
                <Button variant="outline" className="input-premium gap-1.5 rounded-xl" onClick={handlePrint}>
                  <Printer className="size-4" /> Print sheet
                </Button>
                {computationId && (
                  <Button
                    variant="ghost"
                    className="gap-1.5 rounded-xl text-muted-foreground"
                    onClick={() => { setInputs(EMPTY); setComputationId(null) }}
                  >
                    <Calculator className="size-4" /> New sheet
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Saved computations */}
        {saved.length > 0 && (
          <div className="surface-elevated rounded-2xl border border-white/[0.06]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h4 className="text-sm font-semibold">Saved computations</h4>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {saved.map((s) => {
                const res = s.results as { recommended?: string; netPayable?: number } | null
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <button type="button" className="flex-1 text-left" onClick={() => void openSaved(s.id)}>
                      <p className="text-sm font-medium">
                        {s.client.name} — FY {s.financialYear}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.regimeChosen ?? res?.recommended ?? "—"} regime ·{" "}
                        {new Date(s.updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      {typeof res?.netPayable === "number" && (
                        <Badge className={cn(
                          "font-mono",
                          res.netPayable >= 0
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        )}>
                          {res.netPayable >= 0 ? "" : "−"}{formatINR(Math.abs(res.netPayable))}
                        </Badge>
                      )}
                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(s.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Delete computation"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
