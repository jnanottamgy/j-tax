"use client"

/**
 * Financial statements workbench — TB CSV in, Schedule III statements out.
 * The pure engine runs in the browser for instant feedback; the server
 * rebuilds statements from the mapped ledgers on save.
 */

import { useEffect, useMemo, useState } from "react"
import {
  BookOpenCheck,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Printer,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { parseCsv } from "@/lib/csv/parse"
import { BUCKETS, type BucketKey, type BucketSide } from "@/lib/accounts/buckets"
import {
  autoMapLedgers,
  buildStatements,
  parseTbAmount,
  type MappedLedger,
  type StatementSection,
} from "@/lib/accounts/statements"
import { formatINR, financialYearOf } from "@/lib/india/format"
import {
  saveFinancialStatement,
  listFinancialStatements,
  getFinancialStatement,
  deleteFinancialStatement,
  getFsClients,
} from "@/app/actions/financial-statements"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"

// ─── TB column auto-detection ────────────────────────────────────────────────

const normalize = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "")

function detectColumns(headers: string[]) {
  const n = headers.map(normalize)
  const find = (aliases: string[]) => {
    const i = n.findIndex((h) => aliases.includes(h))
    return i === -1 ? null : i
  }
  return {
    name: find(["particulars", "ledger", "ledgername", "account", "accountname", "name", "accounthead"]),
    group: find(["group", "parent", "under", "primarygroup"]),
    debit: find(["debit", "dr", "debitamount", "closingdebit", "closingbalancedr"]),
    credit: find(["credit", "cr", "creditamount", "closingcredit", "closingbalancecr"]),
    amount: find(["amount", "closingbalance", "balance", "netamount"]),
  }
}

const SIDE_LABELS: Record<BucketSide, string> = {
  ASSET: "Balance sheet — assets",
  LIABILITY: "Balance sheet — equity & liabilities",
  INCOME: "P&L — income",
  EXPENSE: "P&L — expenses",
}

const BUCKET_GROUPS = (Object.keys(BUCKETS) as BucketKey[]).reduce(
  (acc, key) => {
    const side = BUCKETS[key].side
    ;(acc[side] ??= []).push(key)
    return acc
  },
  {} as Record<BucketSide, BucketKey[]>
)

type SavedRow = {
  id: string
  financialYear: string
  updatedAt: string | Date
  client: { id: string; name: string }
  statements: unknown
}

function SectionTable({ section }: { section: StatementSection }) {
  return (
    <div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {section.title}
      </p>
      {section.lines.map((line) => (
        <details key={line.bucket} className="group border-b border-white/[0.04] last:border-0">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 text-sm hover:text-foreground">
            <span>{line.label}</span>
            <span className="font-mono tabular-nums">{formatINR(line.amount)}</span>
          </summary>
          <div className="space-y-0.5 pb-2 pl-4">
            {line.ledgers.map((l, i) => (
              <div key={`${l.name}-${i}`} className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{l.name}</span>
                <span className="font-mono tabular-nums">{formatINR(l.amount)}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
      <div className="flex items-center justify-between py-1.5 text-sm font-semibold">
        <span>Total</span>
        <span className="font-mono tabular-nums">{formatINR(section.total)}</span>
      </div>
    </div>
  )
}

export function FinancialStatementsClient() {
  const { role } = useAuth()
  const canDelete = role === "PARTNER" || role === "MANAGER"
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [saved, setSaved] = useState<SavedRow[]>([])
  const [clientId, setClientId] = useState("")
  const [fy, setFy] = useState(financialYearOf().short)
  const [fileName, setFileName] = useState("")
  const [ledgers, setLedgers] = useState<MappedLedger[]>([])
  const [statementId, setStatementId] = useState<string | null>(null)
  const [reviewOnly, setReviewOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const [cs, rows] = await Promise.all([getFsClients(), listFinancialStatements()])
      setClients(cs)
      setSaved(rows as unknown as SavedRow[])
      if (cs[0]) setClientId(cs[0].id)
    })()
  }, [])

  async function handleFile(file: File) {
    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    if (headers.length === 0 || rows.length === 0) {
      toast.error("That CSV has no data rows.")
      return
    }
    const cols = detectColumns(headers)
    if (cols.name === null || (cols.debit === null && cols.credit === null && cols.amount === null)) {
      toast.error(
        "Couldn't find the ledger/amount columns. Expected headings like Particulars, Debit, Credit (Tally trial-balance export)."
      )
      return
    }
    const raw = rows.map((r) => {
      const name = r[cols.name!] ?? ""
      const group = cols.group !== null ? r[cols.group] : null
      let debit = cols.debit !== null ? parseTbAmount(r[cols.debit] ?? "") : 0
      let credit = cols.credit !== null ? parseTbAmount(r[cols.credit] ?? "") : 0
      if (cols.debit === null && cols.credit === null && cols.amount !== null) {
        const amt = parseTbAmount(r[cols.amount] ?? "")
        debit = amt > 0 ? amt : 0
        credit = amt < 0 ? -amt : 0
      }
      return { name, group, debit: Math.abs(debit), credit: Math.abs(credit) }
    })
    // Drop obvious total rows
    const cleaned = raw.filter((r) => !/^(grand\s*)?total$/i.test(r.name.trim()))
    const mapped = autoMapLedgers(cleaned)
    if (mapped.length === 0) {
      toast.error("No non-zero ledger rows found in the file.")
      return
    }
    setFileName(file.name)
    setLedgers(mapped)
    setStatementId(null)
    const unmatched = mapped.filter((l) => !l.matched).length
    toast.success(
      `${mapped.length} ledgers loaded — ${mapped.length - unmatched} auto-classified${unmatched ? `, ${unmatched} need review` : ""}.`
    )
  }

  const statements = useMemo(() => (ledgers.length ? buildStatements(ledgers) : null), [ledgers])

  const visibleLedgers = useMemo(
    () =>
      ledgers
        .map((l, i) => ({ ...l, index: i }))
        .filter((l) => (reviewOnly ? !l.matched : true)),
    [ledgers, reviewOnly]
  )

  function setBucket(index: number, bucket: BucketKey) {
    setLedgers((ls) => ls.map((l, i) => (i === index ? { ...l, bucket, matched: true } : l)))
  }

  async function handleSave() {
    if (!clientId || !statements) return
    setSaving(true)
    try {
      const res = await saveFinancialStatement({
        clientId,
        financialYear: fy,
        ledgers,
        statementId: statementId ?? undefined,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setStatementId(res.id)
      setSaved((await listFinancialStatements()) as unknown as SavedRow[])
      toast.success(statementId ? "Statement updated." : "Statement saved.")
    } finally {
      setSaving(false)
    }
  }

  async function openSaved(id: string) {
    const row = await getFinancialStatement(id)
    if (!row) {
      toast.error("Not found.")
      return
    }
    setClientId(row.clientId)
    setFy(row.financialYear)
    setLedgers(row.ledgers as unknown as MappedLedger[])
    setStatementId(row.id)
    setFileName("(saved statement)")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function handleDelete(id: string) {
    const res = await deleteFinancialStatement(id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    if (statementId === id) setStatementId(null)
    setSaved((await listFinancialStatements()) as unknown as SavedRow[])
    toast.success("Deleted.")
  }

  function handlePrint() {
    if (!statements) return
    const client = clients.find((c) => c.id === clientId)
    const row = (label: string, v: number, strong = false) =>
      `<tr><td style="padding:3px 8px;${strong ? "font-weight:600" : ""}">${label}</td><td style="padding:3px 8px;text-align:right;font-family:monospace;${strong ? "font-weight:600" : ""}">${formatINR(v)}</td></tr>`
    const sec = (s: StatementSection) =>
      `<tr><td colspan="2" style="padding:8px 8px 2px;font-weight:600;text-transform:uppercase;font-size:11px;color:#555">${s.title}</td></tr>` +
      s.lines.map((l) => row(l.label, l.amount)).join("") +
      row(`Total ${s.title.toLowerCase()}`, s.total, true)
    const html = `<!doctype html><html><head><title>Financial Statements — ${client?.name ?? ""}</title></head>
      <body style="font-family:Arial,sans-serif;max-width:760px;margin:24px auto;color:#111">
        <h2 style="margin:0">${client?.name ?? "—"}</h2>
        <p style="margin:4px 0 16px;color:#555">Financial statements for FY ${fy} (from trial balance)</p>
        <h3 style="margin:12px 0 4px">Statement of Profit &amp; Loss</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #ddd">
          ${sec(statements.pl.income)}${sec(statements.pl.expenses)}
          ${row(statements.pl.profitBeforeTax >= 0 ? "Profit before tax" : "Loss before tax", statements.pl.profitBeforeTax, true)}
        </table>
        <h3 style="margin:16px 0 4px">Balance Sheet</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #ddd">
          <tr><td colspan="2" style="padding:8px;font-weight:700">EQUITY AND LIABILITIES</td></tr>
          ${statements.bs.equityAndLiabilities.map(sec).join("")}
          ${row("TOTAL", statements.bs.totalEquityAndLiabilities, true)}
          <tr><td colspan="2" style="padding:8px;font-weight:700">ASSETS</td></tr>
          ${statements.bs.assets.map(sec).join("")}
          ${row("TOTAL", statements.bs.totalAssets, true)}
        </table>
        <p style="margin-top:24px;font-size:11px;color:#777">Prepared with J-TACS on ${new Date().toLocaleDateString("en-IN")}. Subject to audit/verification.</p>
      </body></html>`
    const w = window.open("", "_blank", "width=820,height=900")
    if (!w) {
      toast.error("Allow pop-ups to print the statements.")
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }

  const unmatchedCount = statements?.checks.unmatchedCount ?? 0

  return (
    <div className="space-y-6">
      {/* Setup */}
      <div className="surface-elevated rounded-2xl border border-white/[0.06] p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Client</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-premium h-10 w-full rounded-xl bg-transparent px-3 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Financial year</span>
            <input
              value={fy}
              onChange={(e) => setFy(e.target.value)}
              placeholder="2025-26"
              className="input-premium h-10 w-full rounded-xl bg-transparent px-3 font-mono text-sm"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Trial balance (CSV)</span>
            <div className={cn(
              "input-premium flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3",
              fileName && "border-emerald-500/40"
            )}>
              <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-xs">
                {fileName ? `${fileName} — ${ledgers.length} ledgers` : "Choose .csv (Particulars, Debit, Credit)"}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ""
                }}
              />
            </div>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Tally: Display → Trial Balance → Export as CSV/Excel. Amount columns accept ₹, commas, and Dr/Cr suffixes.
        </p>
      </div>

      {statements && (
        <>
          {/* Checks banner */}
          <div className="flex flex-wrap items-center gap-2">
            {statements.checks.tbBalanced ? (
              <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="size-3" /> Trial balance tallies
              </Badge>
            ) : (
              <Badge className="gap-1 border-red-500/40 bg-red-500/10 text-red-400">
                <TriangleAlert className="size-3" /> TB off by {formatINR(statements.checks.tbDifference)} — statements will not balance
              </Badge>
            )}
            {unmatchedCount > 0 ? (
              <button type="button" onClick={() => setReviewOnly((v) => !v)}>
                <Badge className={cn(
                  "gap-1 border-amber-500/30 bg-amber-500/10 text-amber-400",
                  reviewOnly && "ring-1 ring-amber-400/50"
                )}>
                  <TriangleAlert className="size-3" /> {unmatchedCount} ledger{unmatchedCount === 1 ? "" : "s"} need review — click to filter
                </Badge>
              </button>
            ) : (
              <Badge className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="size-3" /> All ledgers classified
              </Badge>
            )}
            <Badge className={cn(
              "gap-1",
              statements.pl.profitBeforeTax >= 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            )}>
              {statements.pl.profitBeforeTax >= 0 ? "Profit" : "Loss"} {formatINR(Math.abs(statements.pl.profitBeforeTax))}
            </Badge>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="input-premium gap-1.5 rounded-xl" onClick={handlePrint}>
              <Printer className="size-3.5" /> Print
            </Button>
            <Button size="sm" className="btn-glow gap-1.5 rounded-xl" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              {statementId ? "Update" : "Save"}
            </Button>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* Ledger mapping workbench */}
            <div className="surface-elevated overflow-hidden rounded-2xl border border-white/[0.06]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <h4 className="text-sm font-semibold">Ledger mapping</h4>
                <span className="text-xs text-muted-foreground">{visibleLedgers.length} shown</span>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {visibleLedgers.map((l) => (
                      <tr
                        key={l.index}
                        className={cn(
                          "border-b border-white/[0.04] last:border-0",
                          !l.matched && "bg-amber-500/[0.06]"
                        )}
                      >
                        <td className="max-w-40 px-3 py-2">
                          <p className="truncate font-medium" title={l.name}>{l.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {l.debit > 0 ? `Dr ${formatINR(l.debit)}` : `Cr ${formatINR(l.credit)}`}
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={l.bucket}
                            onChange={(e) => setBucket(l.index, e.target.value as BucketKey)}
                            className={cn(
                              "input-premium h-8 w-full rounded-lg bg-transparent px-2 text-xs",
                              !l.matched && "border-amber-500/40"
                            )}
                          >
                            {(Object.keys(BUCKET_GROUPS) as BucketSide[]).map((side) => (
                              <optgroup key={side} label={SIDE_LABELS[side]}>
                                {BUCKET_GROUPS[side].map((b) => (
                                  <option key={b} value={b}>{BUCKETS[b].label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Statements */}
            <div className="space-y-4">
              <div className="surface-elevated rounded-2xl border border-white/[0.06] p-4">
                <h4 className="text-sm font-semibold">Statement of Profit &amp; Loss</h4>
                <SectionTable section={statements.pl.income} />
                <SectionTable section={statements.pl.expenses} />
                <div className="mt-2 flex items-center justify-between border-t border-white/[0.12] pt-2 text-sm font-semibold">
                  <span>{statements.pl.profitBeforeTax >= 0 ? "Profit before tax" : "Loss before tax"}</span>
                  <span className={cn(
                    "font-mono tabular-nums",
                    statements.pl.profitBeforeTax >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {formatINR(statements.pl.profitBeforeTax)}
                  </span>
                </div>
              </div>

              <div className="surface-elevated rounded-2xl border border-white/[0.06] p-4">
                <h4 className="text-sm font-semibold">Balance Sheet</h4>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wide">Equity and liabilities</p>
                {statements.bs.equityAndLiabilities.map((s) => (
                  <SectionTable key={s.title} section={s} />
                ))}
                <div className="flex items-center justify-between border-t border-white/[0.12] py-1.5 text-sm font-semibold">
                  <span>Total equity and liabilities</span>
                  <span className="font-mono tabular-nums">{formatINR(statements.bs.totalEquityAndLiabilities)}</span>
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide">Assets</p>
                {statements.bs.assets.map((s) => (
                  <SectionTable key={s.title} section={s} />
                ))}
                <div className="flex items-center justify-between border-t border-white/[0.12] py-1.5 text-sm font-semibold">
                  <span>Total assets</span>
                  <span className={cn(
                    "font-mono tabular-nums",
                    statements.checks.bsBalanced ? "text-emerald-400" : "text-red-400"
                  )}>
                    {formatINR(statements.bs.totalAssets)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Saved statements */}
      {saved.length > 0 && (
        <div className="surface-elevated rounded-2xl border border-white/[0.06]">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h4 className="text-sm font-semibold">Saved statements</h4>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {saved.map((s) => {
              const st = s.statements as { pl?: { profitBeforeTax?: number } } | null
              const pbt = st?.pl?.profitBeforeTax
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <button type="button" className="flex-1 text-left" onClick={() => void openSaved(s.id)}>
                    <p className="text-sm font-medium">{s.client.name} — FY {s.financialYear}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    {typeof pbt === "number" && (
                      <Badge className={cn(
                        "font-mono",
                        pbt >= 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-red-500/30 bg-red-500/10 text-red-400"
                      )}>
                        {pbt >= 0 ? "PBT " : "Loss "}{formatINR(Math.abs(pbt))}
                      </Badge>
                    )}
                    {canDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(s.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Delete statement"
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

      {ledgers.length === 0 && saved.length === 0 && (
        <div className="surface-elevated flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] px-4 py-12 text-center">
          <BookOpenCheck className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No statements yet</p>
          <p className="text-xs text-muted-foreground">
            Upload a trial balance CSV — try samples/trial-balance-sample.csv in the repo.
          </p>
        </div>
      )}
    </div>
  )
}
