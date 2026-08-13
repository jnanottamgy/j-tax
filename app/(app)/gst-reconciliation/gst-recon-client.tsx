"use client"

/**
 * GSTR-2B reconciliation workbench.
 *
 * Setup: pick client + period, drop the portal's 2B JSON and the purchase
 * register CSV (columns auto-map), run. Both files are parsed in the browser
 * (pure libs) so feedback is instant; the server re-parses and persists an
 * immutable run.
 */

import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  GitCompareArrows,
  Loader2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { parseCsv, toCsv } from "@/lib/csv/parse"
import { parseGstr2b, type Gstr2bParseResult } from "@/lib/gst/gstr2b"
import type { ReconEntry, ReconSummary, ReconBucket } from "@/lib/gst/reconcile"
import { formatINR } from "@/lib/india/format"
import {
  runGstReconciliation,
  listGstReconRuns,
  getGstReconRun,
  getReconClients,
  type WireRegisterRow,
} from "@/app/actions/gst-recon"
import { cn } from "@/lib/utils"

// ─── Register CSV column mapping ─────────────────────────────────────────────

const REGISTER_FIELDS = [
  { key: "supplierGstin", label: "Supplier GSTIN", required: true },
  { key: "supplierName", label: "Supplier name", required: false },
  { key: "docNumber", label: "Invoice / doc no.", required: true },
  { key: "docDate", label: "Invoice date", required: false },
  { key: "taxableValue", label: "Taxable value", required: true },
  { key: "igst", label: "IGST", required: false },
  { key: "cgst", label: "CGST", required: false },
  { key: "sgst", label: "SGST", required: false },
  { key: "cess", label: "Cess", required: false },
] as const

type RegisterKey = (typeof REGISTER_FIELDS)[number]["key"]

const REGISTER_ALIASES: Record<RegisterKey, string[]> = {
  supplierGstin: ["gstin", "suppliergstin", "gstinuin", "gstno", "ctin", "gstinofsupplier", "partygstin"],
  supplierName: ["supplier", "suppliername", "party", "partyname", "vendor", "vendorname", "nameofsupplier"],
  docNumber: ["invoiceno", "invoicenumber", "billno", "voucherno", "docno", "invno", "documentnumber", "invoicebillno"],
  docDate: ["invoicedate", "billdate", "date", "voucherdate", "docdate"],
  taxableValue: ["taxablevalue", "taxableamount", "taxable", "assessablevalue", "txval"],
  igst: ["igst", "integratedtax", "igstamount", "igstamt"],
  cgst: ["cgst", "centraltax", "cgstamount", "cgstamt"],
  sgst: ["sgst", "statetax", "sgstutgst", "stateuttax", "sgstamount", "sgstamt"],
  cess: ["cess", "cessamount", "cessamt"],
}

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "")

function autoMapRegister(headers: string[]): Record<RegisterKey, number | null> {
  const normalized = headers.map(normalizeHeader)
  const taken = new Set<number>()
  const map = {} as Record<RegisterKey, number | null>
  for (const f of REGISTER_FIELDS) {
    let found: number | null = null
    for (const alias of REGISTER_ALIASES[f.key]) {
      const idx = normalized.findIndex((h, i) => h === alias && !taken.has(i))
      if (idx !== -1) { found = idx; break }
    }
    if (found !== null) taken.add(found)
    map[f.key] = found
  }
  return map
}

const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

/** dd-mm-yyyy / dd/mm/yyyy / yyyy-mm-dd / 1-Apr-2026 → ISO date string */
function parseRegisterDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).toISOString()
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString()
  m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/)
  if (m) {
    const month = MONTHS_SHORT.indexOf(m[2].slice(0, 3).toLowerCase())
    if (month === -1) return null
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return new Date(year, month, Number(m[1])).toISOString()
  }
  return null
}

const parseAmount = (raw: string) => Number(raw.replace(/[₹,\s]/g, "")) || 0

// ─── Period helpers (MMYYYY, portal convention) ──────────────────────────────

function defaultPeriod(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1) // previous month is the one you reconcile
  return `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`
}

function periodLabel(p: string): string {
  const m = p.match(/^(\d{2})(\d{4})$/)
  if (!m) return p
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[Number(m[1]) - 1]} ${m[2]}`
}

// ─── Bucket presentation ─────────────────────────────────────────────────────

const BUCKETS: Array<{ key: ReconBucket; label: string; tone: string }> = [
  { key: "MATCHED", label: "Matched", tone: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { key: "MISMATCH", label: "Value mismatch", tone: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { key: "MISSING_IN_BOOKS", label: "Missing in books", tone: "text-sky-400 border-sky-500/30 bg-sky-500/10" },
  { key: "MISSING_IN_2B", label: "Missing in 2B", tone: "text-red-400 border-red-500/30 bg-red-500/10" },
]

type RunView = {
  runId: string
  clientName: string
  period: string
  summary: ReconSummary
  diagnostics: string[]
  entries: ReconEntry[]
}

type PastRun = {
  id: string
  period: string
  createdAt: string | Date
  client: { id: string; name: string }
  summary: unknown
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GstReconClient() {
  const [clients, setClients] = useState<Array<{ id: string; name: string; gstin: string | null }>>([])
  const [pastRuns, setPastRuns] = useState<PastRun[]>([])
  // Seeded from ?clientId=… so Client 360 → Workpapers opens this tool already
  // scoped, instead of dropping the user into a list of every client to find
  // the one they were just looking at.
  const searchParams = useSearchParams()
  const [clientId, setClientId] = useState(() => searchParams.get("clientId") ?? "")
  const [period, setPeriod] = useState(defaultPeriod())

  const [portalFile, setPortalFile] = useState<{ name: string; text: string; parsed: Gstr2bParseResult } | null>(null)
  const [registerCsv, setRegisterCsv] = useState<{ name: string; headers: string[]; rows: string[][] } | null>(null)
  const [mapping, setMapping] = useState<Record<RegisterKey, number | null> | null>(null)

  const [running, setRunning] = useState(false)
  const [view, setView] = useState<RunView | null>(null)
  const [activeBucket, setActiveBucket] = useState<ReconBucket>("MISMATCH")

  useEffect(() => {
    void (async () => {
      const [cs, runs] = await Promise.all([getReconClients(), listGstReconRuns()])
      setClients(cs)
      setPastRuns(runs as unknown as PastRun[])
      const firstWithGstin = cs.find((c) => c.gstin)
      if (firstWithGstin) setClientId(firstWithGstin.id)
      else if (cs[0]) setClientId(cs[0].id)
    })()
  }, [])

  async function handlePortalFile(file: File) {
    const text = await file.text()
    const parsed = parseGstr2b(text)
    setPortalFile({ name: file.name, text, parsed })
    if (parsed.period) setPeriod(parsed.period)
    if (parsed.docs.length === 0) {
      toast.error(parsed.diagnostics[0] ?? "No documents found in that file.")
    }
  }

  async function handleRegisterFile(file: File) {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("That CSV has no data rows.")
      return
    }
    setRegisterCsv({ name: file.name, headers: parsed.headers, rows: parsed.rows })
    setMapping(autoMapRegister(parsed.headers))
  }

  const registerRows: WireRegisterRow[] = useMemo(() => {
    if (!registerCsv || !mapping) return []
    const pick = (r: string[], key: RegisterKey) => {
      const idx = mapping[key]
      return idx === null || idx === undefined ? "" : (r[idx] ?? "").trim()
    }
    return registerCsv.rows
      .map((r) => ({
        supplierGstin: pick(r, "supplierGstin"),
        supplierName: pick(r, "supplierName") || null,
        docNumber: pick(r, "docNumber"),
        docDate: parseRegisterDate(pick(r, "docDate")),
        taxableValue: parseAmount(pick(r, "taxableValue")),
        igst: parseAmount(pick(r, "igst")),
        cgst: parseAmount(pick(r, "cgst")),
        sgst: parseAmount(pick(r, "sgst")),
        cess: parseAmount(pick(r, "cess")),
      }))
      .filter((r) => r.supplierGstin && r.docNumber)
  }, [registerCsv, mapping])

  const canRun = Boolean(clientId && portalFile && portalFile.parsed.docs.length > 0 && registerRows.length > 0 && !running)

  async function handleRun() {
    if (!portalFile) return
    setRunning(true)
    try {
      const res = await runGstReconciliation({
        clientId,
        period,
        gstr2bText: portalFile.text,
        registerRows,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      const full = await getGstReconRun(res.runId)
      if (full) {
        setView({
          runId: res.runId,
          clientName: full.run.clientName,
          period: full.run.period,
          summary: full.run.summary,
          diagnostics: full.run.diagnostics,
          entries: full.entries,
        })
        setActiveBucket(full.run.summary.counts.MISMATCH > 0 ? "MISMATCH" : "MISSING_IN_2B")
        setPastRuns((await listGstReconRuns()) as unknown as PastRun[])
        toast.success("Reconciliation complete.")
      }
    } finally {
      setRunning(false)
    }
  }

  async function openRun(runId: string) {
    const full = await getGstReconRun(runId)
    if (!full) {
      toast.error("Run not found.")
      return
    }
    setView({
      runId,
      clientName: full.run.clientName,
      period: full.run.period,
      summary: full.run.summary,
      diagnostics: full.run.diagnostics,
      entries: full.entries,
    })
    setActiveBucket(full.run.summary.counts.MISMATCH > 0 ? "MISMATCH" : "MISSING_IN_2B")
  }

  function exportBucket(bucket: ReconBucket) {
    if (!view) return
    const rows = view.entries.filter((e) => e.bucket === bucket)
    const csv = toCsv(
      ["supplierGstin", "supplierName", "docNumberBooks", "docNumber2B", "taxableBooks", "taxable2B", "taxBooks", "tax2B", "taxableDelta", "taxDelta", "matchTier"],
      rows.map((e) => [
        e.supplierGstin,
        e.supplierName ?? "",
        e.books?.docNumber ?? "",
        e.portal?.docNumber ?? "",
        e.books?.taxableValue ?? "",
        e.portal?.taxableValue ?? "",
        e.books?.totalTax ?? "",
        e.portal?.totalTax ?? "",
        e.deltas?.taxableValue ?? "",
        e.deltas?.totalTax ?? "",
        e.matchTier ?? "",
      ])
    )
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gstr2b-recon-${view.period}-${bucket.toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Setup */}
      <div className="surface-elevated rounded-2xl border border-white/[0.06] p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Client</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-premium h-10 w-full rounded-xl bg-transparent px-3 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.gstin ? `(${c.gstin})` : "(no GSTIN)"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Return period</span>
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="MMYYYY e.g. 062026"
              className="input-premium h-10 w-full rounded-xl bg-transparent px-3 font-mono text-sm"
            />
            <span className="text-[11px] text-muted-foreground">{periodLabel(period)}</span>
          </label>

          {/* 2B file */}
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">GSTR-2B JSON (portal download)</span>
            <div className={cn(
              "input-premium flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm",
              portalFile && "border-emerald-500/40"
            )}>
              <FileJson className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs">
                {portalFile ? `${portalFile.name} — ${portalFile.parsed.docs.length} docs` : "Choose .json"}
              </span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handlePortalFile(f)
                  e.target.value = ""
                }}
              />
            </div>
          </label>

          {/* Register file */}
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Purchase register (CSV)</span>
            <div className={cn(
              "input-premium flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm",
              registerCsv && "border-emerald-500/40"
            )}>
              <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs">
                {registerCsv ? `${registerCsv.name} — ${registerRows.length} usable rows` : "Choose .csv"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleRegisterFile(f)
                  e.target.value = ""
                }}
              />
            </div>
          </label>
        </div>

        {/* Column mapping (shown once a register is loaded) */}
        {registerCsv && mapping && (
          <div className="grid gap-2 rounded-xl border border-white/[0.06] bg-black/10 p-3 sm:grid-cols-3">
            {REGISTER_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 text-muted-foreground">
                  {f.label}{f.required ? " *" : ""}
                </span>
                <select
                  value={mapping[f.key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => m && { ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className="input-premium h-8 w-full rounded-lg bg-transparent px-2 text-xs"
                >
                  <option value="">— not in file —</option>
                  {registerCsv.headers.map((h, i) => (
                    <option key={`${h}-${i}`} value={i}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {portalFile && portalFile.parsed.diagnostics.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <div>{portalFile.parsed.diagnostics.map((d, i) => <p key={i}>{d}</p>)}</div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Portal: Returns dashboard → GSTR-2B → Download JSON · Register: export from Tally/Excel as CSV
          </p>
          <Button className="btn-glow gap-1.5 rounded-xl" disabled={!canRun} onClick={() => void handleRun()}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <GitCompareArrows className="size-4" />}
            {running ? "Reconciling…" : "Run reconciliation"}
          </Button>
        </div>
      </div>

      {/* Results */}
      {view && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {view.clientName} — {periodLabel(view.period)}
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="input-premium gap-1.5 rounded-xl"
              onClick={() => exportBucket(activeBucket)}
            >
              <Download className="size-3.5" /> Export {BUCKETS.find((b) => b.key === activeBucket)?.label}
            </Button>
          </div>

          {view.diagnostics.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <div>{view.diagnostics.map((d, i) => <p key={i}>{d}</p>)}</div>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="surface-elevated rounded-xl border border-emerald-500/20 p-4">
              <p className="text-xs text-muted-foreground">Matched</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-400">{view.summary.counts.MATCHED}</p>
            </div>
            <div className="surface-elevated rounded-xl border border-amber-500/20 p-4">
              <p className="text-xs text-muted-foreground">Value mismatches</p>
              <p className="mt-1 text-2xl font-semibold text-amber-400">{view.summary.counts.MISMATCH}</p>
              <p className="text-[11px] text-muted-foreground">net Δ {formatINR(view.summary.mismatchTaxDelta)}</p>
            </div>
            <div className="surface-elevated rounded-xl border border-sky-500/20 p-4">
              <p className="text-xs text-muted-foreground">Unclaimed ITC (in 2B, not booked)</p>
              <p className="mt-1 text-2xl font-semibold text-sky-400">{formatINR(view.summary.unclaimedItc)}</p>
              <p className="text-[11px] text-muted-foreground">{view.summary.counts.MISSING_IN_BOOKS} docs</p>
            </div>
            <div className="surface-elevated rounded-xl border border-red-500/20 p-4">
              <p className="text-xs text-muted-foreground">ITC at risk (booked, not in 2B)</p>
              <p className="mt-1 text-2xl font-semibold text-red-400">{formatINR(view.summary.itcAtRisk)}</p>
              <p className="text-[11px] text-muted-foreground">{view.summary.counts.MISSING_IN_2B} docs</p>
            </div>
          </div>

          {/* Bucket tabs */}
          <div className="flex flex-wrap gap-2">
            {BUCKETS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setActiveBucket(b.key)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  activeBucket === b.key ? b.tone : "border-white/[0.08] text-muted-foreground hover:text-foreground"
                )}
              >
                {b.label} ({view.summary.counts[b.key]})
              </button>
            ))}
          </div>

          {/* Entries table */}
          <div className="surface-elevated overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Supplier</th>
                  <th className="px-3 py-2.5 font-medium">Doc (books)</th>
                  <th className="px-3 py-2.5 font-medium">Doc (2B)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Taxable (books)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Taxable (2B)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tax (books)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Tax (2B)</th>
                  <th className="px-3 py-2.5 text-right font-medium">Δ tax</th>
                  <th className="px-3 py-2.5 font-medium">Tier</th>
                </tr>
              </thead>
              <tbody>
                {view.entries
                  .filter((e) => e.bucket === activeBucket)
                  .slice(0, 300)
                  .map((e, i) => (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0">
                      <td className="max-w-52 px-3 py-2">
                        <p className="truncate font-medium">{e.supplierName ?? "—"}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{e.supplierGstin}</p>
                      </td>
                      <td className="px-3 py-2 font-mono">{e.books?.docNumber ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{e.portal?.docNumber ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.books ? formatINR(e.books.taxableValue) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.portal ? formatINR(e.portal.taxableValue) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.books ? formatINR(e.books.totalTax) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.portal ? formatINR(e.portal.totalTax) : "—"}</td>
                      <td className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        (e.deltas?.totalTax ?? 0) > 0 && "text-sky-400",
                        (e.deltas?.totalTax ?? 0) < 0 && "text-red-400"
                      )}>
                        {e.deltas ? formatINR(e.deltas.totalTax) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {e.matchTier && (
                          <Badge className="border-white/[0.1] bg-white/[0.04] text-[10px] text-muted-foreground">
                            {e.matchTier}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {view.entries.filter((e) => e.bucket === activeBucket).length === 0 && (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-400" /> Nothing in this bucket.
              </p>
            )}
            {view.entries.filter((e) => e.bucket === activeBucket).length > 300 && (
              <p className="px-4 py-2 text-[11px] text-muted-foreground">
                Showing first 300 — export the bucket for the full list.
              </p>
            )}
          </div>

          {/* Vendor rollup */}
          <div className="surface-elevated overflow-x-auto rounded-2xl border border-white/[0.06]">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <h4 className="text-sm font-semibold">Vendor-wise ITC (sorted by gap)</h4>
            </div>
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Supplier</th>
                  <th className="px-3 py-2.5 text-right font-medium">Docs</th>
                  <th className="px-3 py-2.5 text-right font-medium">Books ITC</th>
                  <th className="px-3 py-2.5 text-right font-medium">2B ITC</th>
                  <th className="px-3 py-2.5 text-right font-medium">Gap (2B − books)</th>
                </tr>
              </thead>
              <tbody>
                {view.summary.vendors.slice(0, 50).map((v) => (
                  <tr key={v.supplierGstin} className="border-b border-white/[0.04] last:border-0">
                    <td className="max-w-64 px-3 py-2">
                      <p className="truncate font-medium">{v.supplierName ?? "—"}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{v.supplierGstin}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.docs}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatINR(v.booksTax)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatINR(v.portalTax)}</td>
                    <td className={cn(
                      "px-3 py-2 text-right font-medium tabular-nums",
                      v.diff > 0 && "text-sky-400",
                      v.diff < 0 && "text-red-400"
                    )}>
                      {formatINR(v.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Past runs */}
      {pastRuns.length > 0 && (
        <div className="surface-elevated rounded-2xl border border-white/[0.06]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h4 className="text-sm font-semibold">Past reconciliations</h4>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {pastRuns.map((r) => {
              const s = r.summary as ReconSummary | null
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void openRun(r.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {r.client.name} — {periodLabel(r.period)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {s && (
                      <>
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400">{s.counts.MATCHED} ✓</Badge>
                        {s.counts.MISMATCH > 0 && (
                          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-400">{s.counts.MISMATCH} Δ</Badge>
                        )}
                        {s.itcAtRisk > 0 && (
                          <Badge className="border-red-500/30 bg-red-500/10 text-red-400">{formatINR(s.itcAtRisk)} at risk</Badge>
                        )}
                      </>
                    )}
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
