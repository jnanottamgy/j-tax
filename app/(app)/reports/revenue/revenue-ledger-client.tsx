"use client"

import { useMemo, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { formatINR } from "@/lib/india/format"
import { ALL_SERVICE_TYPES, serviceLabel } from "@/lib/clients/constants"
import { recentFinancialYears } from "@/lib/india/format"
import type { RevenueLedger, RevenueMetric } from "@/app/actions/revenue"
import { cn } from "@/lib/utils"

const INVOICE_STATUSES = [
  "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED", "WAIVED",
] as const

const METRIC_LABEL: Record<RevenueMetric, string> = {
  revenue: "All invoiced",
  collected: "Received only",
  outstanding: "Outstanding only",
  overdue: "Overdue only",
}

const STATUS_TONE: Record<string, string> = {
  PAID: "text-emerald-400",
  PARTIALLY_PAID: "text-amber-400",
  OVERDUE: "text-red-400",
  DISPUTED: "text-red-400",
  WAIVED: "text-muted-foreground",
}

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : DATE.format(d)
}

type Filters = {
  fy?: string
  clientId?: string
  status?: string
  serviceType?: string
  metric?: RevenueMetric
}

export function RevenueLedgerClient({
  ledger,
  filters,
}: {
  ledger: RevenueLedger
  filters: Filters
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const fyOptions = useMemo(() => recentFinancialYears(6), [])

  /** Filters live in the URL so the view is shareable and the export matches. */
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (!value) next.delete(key)
    else next.set(key, value)
    startTransition(() => router.push(`/reports/revenue?${next.toString()}`))
  }

  const exportHref = (format: "xlsx" | "csv") => {
    const next = new URLSearchParams(searchParams.toString())
    next.set("format", format)
    return `/reports/revenue/export?${next.toString()}`
  }

  const s = ledger.summary

  const tiles = [
    { label: "Total invoiced", value: s.invoiced, hint: `${s.invoiceCount} invoices` },
    { label: "Received", value: s.collected, hint: "Payments recorded" },
    { label: "Outstanding", value: s.outstanding, hint: "Yet to be collected" },
    { label: "Overdue", value: s.overdue, hint: "Past due date", danger: true },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        label="Reports"
        title="Revenue"
        description={`Every invoice behind the number — who it was raised on, for what work, when it was billed and paid. Showing ${ledger.applied.label}.`}
        backHref="/"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              {/* Plain links, not fetch+blob — the browser streams the file and
                  the download survives navigation. */}
              <a href={exportHref("csv")}>
                <Download className="mr-2 size-4" />
                CSV
              </a>
            </Button>
            <Button asChild>
              <a href={exportHref("xlsx")}>
                <FileSpreadsheet className="mr-2 size-4" />
                Export to Excel
              </a>
            </Button>
          </div>
        }
      />

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="border-white/[0.08] bg-white/[0.02]">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold tabular-nums",
                  t.danger && t.value > 0 && "text-red-400"
                )}
              >
                {formatINR(t.value)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">{t.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Contracted vs invoiced ───────────────────────────────────────
          What the firm agreed to earn, against what it actually billed. The
          agreed fee used to live only on the quotation and was dropped at
          conversion, so this comparison was impossible — an engagement could
          run for a year unbilled and nothing would say so. */}
      {(s.contractedAnnual > 0 || s.engagementsWithoutFee > 0) && (
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
            <div>
              <p className="text-xs text-muted-foreground">Contracted, annualised</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {formatINR(s.contractedAnnual)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                Agreed fees across every active engagement
              </p>
            </div>

            {s.contractedAnnual > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Invoiced this period</p>
                <p
                  className={cn(
                    "mt-1 text-xl font-semibold tabular-nums",
                    s.professionalFees < s.contractedAnnual * 0.6 && "text-amber-400"
                  )}
                >
                  {Math.round((s.professionalFees / s.contractedAnnual) * 100)}%
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  {formatINR(s.professionalFees)} in professional fees, excl. GST
                </p>
              </div>
            )}

            {s.engagementsWithoutFee > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Engagements with no fee</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-amber-400">
                  {s.engagementsWithoutFee}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  Set a fee on the client so these count here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <Card className="border-white/[0.08] bg-white/[0.02]">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Financial year">
            <select
              value={filters.fy ?? ledger.applied.fy}
              onChange={(e) => setParam("fy", e.target.value)}
              className="h-9 rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
            >
              {fyOptions.map((fy) => (
                <option key={fy.short} value={fy.short}>
                  {fy.label}
                </option>
              ))}
              <option value="all">All time</option>
            </select>
          </Field>

          <Field label="Client">
            <select
              value={filters.clientId ?? ""}
              onChange={(e) => setParam("clientId", e.target.value)}
              className="h-9 min-w-44 rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
            >
              <option value="">All clients</option>
              {ledger.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Service">
            <select
              value={filters.serviceType ?? ""}
              onChange={(e) => setParam("serviceType", e.target.value)}
              className="h-9 rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
            >
              <option value="">All services</option>
              {ALL_SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {serviceLabel(t)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status">
            <select
              value={filters.status ?? ""}
              onChange={(e) => setParam("status", e.target.value)}
              className="h-9 rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
            >
              <option value="">All statuses</option>
              {INVOICE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>

          <Field label="View">
            <select
              value={filters.metric ?? "revenue"}
              onChange={(e) => setParam("metric", e.target.value)}
              className="h-9 rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
            >
              {(Object.keys(METRIC_LABEL) as RevenueMetric[]).map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>

          {isPending && (
            <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />
          )}
        </CardContent>
      </Card>

      {/* ── Rollups ─────────────────────────────────────────────────────── */}
      {ledger.rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Rollup title="By client" rows={ledger.byClient} total={s.invoiced} />
          <Rollup title="By service" rows={ledger.byService} total={s.invoiced} />
          <Rollup title="By month" rows={ledger.byMonth} total={s.invoiced} />
        </div>
      )}

      {/* ── Detail ──────────────────────────────────────────────────────── */}
      <Card className="border-white/[0.08] bg-white/[0.02]">
        <CardContent className="p-0">
          {ledger.rows.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={FileSpreadsheet}
                title="No invoices in this view"
                description="Try a wider financial year, or clear the client and status filters."
              />
            </div>
          ) : (
            // The table is wide by design — scroll it inside its own container
            // so the page itself never scrolls sideways.
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] text-sm">
                <thead className="border-b border-white/[0.08] bg-white/[0.02]">
                  <tr className="text-left text-xs text-muted-foreground">
                    <Th>Invoice</Th>
                    <Th>Client</Th>
                    <Th>What for</Th>
                    <Th>Place of supply</Th>
                    <Th className="text-right">Fee</Th>
                    <Th className="text-right">GST</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Received</Th>
                    <Th className="text-right">Outstanding</Th>
                    <Th>Issued</Th>
                    <Th>Due</Th>
                    <Th>Paid on</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r) => (
                    <tr
                      key={r.invoiceId}
                      className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]"
                    >
                      <Td>
                        <Link
                          href={`/payments/invoices/${r.invoiceId}`}
                          className="font-medium hover:text-primary"
                        >
                          {r.invoiceNumber}
                        </Link>
                        {r.revisionNumber > 0 && (
                          <span className="ml-1 text-[10px] text-amber-400">
                            rev {r.revisionNumber}
                          </span>
                        )}
                      </Td>
                      <Td>
                        <Link
                          href={`/clients/${r.clientId}`}
                          className="hover:text-primary"
                        >
                          {r.clientName}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                          {r.clientCode}
                          {r.clientGstin ? ` · ${r.clientGstin}` : ""}
                        </div>
                      </Td>
                      <Td>
                        <div className="max-w-[260px] truncate" title={r.serviceDescription ?? ""}>
                          {r.serviceDescription || "—"}
                        </div>
                        {r.serviceType && (
                          <Badge variant="outline" className="mt-1 text-[10px]">
                            {serviceLabel(r.serviceType as never)}
                          </Badge>
                        )}
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {r.placeOfSupplyName ?? r.placeOfSupply ?? "—"}
                        {r.igstAmount ? (
                          <div className="text-[10px]">IGST</div>
                        ) : r.cgstAmount ? (
                          <div className="text-[10px]">CGST + SGST</div>
                        ) : null}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.professionalFee !== null ? formatINR(r.professionalFee) : "—"}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.taxAmount !== null ? formatINR(r.taxAmount) : "—"}
                      </Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatINR(r.amount)}
                      </Td>
                      <Td className="text-right tabular-nums text-emerald-400">
                        {r.paidAmount > 0 ? formatINR(r.paidAmount) : "—"}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {r.outstandingAmount > 0 ? (
                          <span className={r.daysOverdue > 0 ? "text-red-400" : ""}>
                            {formatINR(r.outstandingAmount)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {fmtDate(r.issueDate)}
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {fmtDate(r.dueDate)}
                        {r.daysOverdue > 0 && (
                          <div className="text-[10px] text-red-400">
                            {r.daysOverdue}d overdue
                          </div>
                        )}
                      </Td>
                      <Td className="text-xs text-muted-foreground">
                        {fmtDate(r.lastPaymentDate)}
                        {r.paymentMethods && (
                          <div className="text-[10px]">{r.paymentMethods}</div>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            STATUS_TONE[r.status] ?? "text-muted-foreground"
                          )}
                        >
                          {r.status.replace(/_/g, " ")}
                        </span>
                        {r.remarks && (
                          <div
                            className="max-w-[160px] truncate text-[10px] text-muted-foreground"
                            title={r.remarks}
                          >
                            {r.remarks}
                          </div>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-white/[0.1] bg-white/[0.02]">
                  <tr className="font-medium">
                    <Td colSpan={4}>
                      {s.invoiceCount} invoices · {s.clientCount} clients
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatINR(s.professionalFees)}
                    </Td>
                    <Td className="text-right tabular-nums">{formatINR(s.tax)}</Td>
                    <Td className="text-right tabular-nums">{formatINR(s.invoiced)}</Td>
                    <Td className="text-right tabular-nums text-emerald-400">
                      {formatINR(s.collected)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatINR(s.outstanding)}
                    </Td>
                    <Td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <div>{children}</div>
    </div>
  )
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-3 py-2.5 font-medium", className)}>
      {children}
    </th>
  )
}

function Td({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-2.5 align-top", className)}>
      {children}
    </td>
  )
}

function Rollup({
  title,
  rows,
  total,
}: {
  title: string
  rows: { key: string; label: string; amount: number; count: number }[]
  total: number
}) {
  const top = rows.slice(0, 6)
  return (
    <Card className="border-white/[0.08] bg-white/[0.02]">
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {top.length === 0 && <p className="text-xs text-muted-foreground/60">—</p>}
        {top.map((r) => {
          const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0
          return (
            <div key={r.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate" title={r.label}>
                  {r.label}
                </span>
                <span className="shrink-0 tabular-nums">{formatINR(r.amount)}</span>
              </div>
              {/* Share-of-total bar — turns a column of numbers into a ranking
                  you can read at a glance. */}
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full bg-primary/60" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
        {rows.length > top.length && (
          <p className="pt-1 text-[11px] text-muted-foreground/70">
            +{rows.length - top.length} more — see the export
          </p>
        )}
      </CardContent>
    </Card>
  )
}
