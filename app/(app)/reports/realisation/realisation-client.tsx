"use client"

/**
 * Quoted → invoiced → collected, side by side for the first time.
 *
 * A firm can be fully booked and quietly losing money in two places at once:
 * work agreed and never billed, and work billed and never collected. Both
 * numbers existed in the database and neither could be seen next to the other,
 * so the first sign of either was a cash crunch.
 */

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, IndianRupee } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { Button } from "@/components/ui/button"
import { getFeeRealisation, type FeeRealisationReport } from "@/app/actions/fee-realisation"
import { formatINR } from "@/lib/india/format"
import { recentFinancialYears } from "@/lib/india/format"

const pctText = (v: number | null) => (v == null ? "—" : `${v}%`)

/** Green above 90, amber 70–90, red below — the bands a partner would use. */
const rateTone = (v: number | null) =>
  v == null
    ? "text-muted-foreground"
    : v >= 90
      ? "text-emerald-400"
      : v >= 70
        ? "text-amber-400"
        : "text-red-400"

export function RealisationClient() {
  const [scope, setScope] = useState<"client" | "service">("client")
  const [fy, setFy] = useState(() => recentFinancialYears(1)[0].short)
  const [report, setReport] = useState<FeeRealisationReport | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    setReport(null)
    getFeeRealisation({ financialYear: fy, scope })
      .then((r) => { if (!cancelled) setReport(r) })
      .catch(() => { if (!cancelled) setReport(null) })
    return () => { cancelled = true }
  }, [fy, scope])

  const t = report?.totals

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-white/[0.07] p-0.5">
          {(["client", "service"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => startTransition(() => setScope(s))}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                scope === s ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
              }`}
            >
              By {s}
            </button>
          ))}
        </div>
        <select
          value={fy}
          onChange={(e) => setFy(e.target.value)}
          className="input-premium h-9 rounded-xl px-3 text-sm"
        >
          {recentFinancialYears(5).map((y) => (
            <option key={y.short} value={y.short}>
              {y.label}
            </option>
          ))}
        </select>
      </div>

      {t && (
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard hover={false} className="p-5">
            <p className="text-xs text-muted-foreground">Billed against agreed</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${rateTone(t.billingRate)}`}>
              {pctText(t.billingRate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatINR(t.invoiced)} invoiced of {formatINR(t.quoted)} agreed
            </p>
          </GlassCard>
          <GlassCard hover={false} className="p-5">
            <p className="text-xs text-muted-foreground">Collected against billed</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${rateTone(t.collectionRate)}`}>
              {pctText(t.collectionRate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatINR(t.outstanding)} still outstanding
            </p>
          </GlassCard>
          <GlassCard hover={false} className="p-5">
            <p className="text-xs text-muted-foreground">Realisation</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${rateTone(t.realisationRate)}`}>
              {pctText(t.realisationRate)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              of everything agreed, actually in the bank
            </p>
          </GlassCard>
        </div>
      )}

      {t && t.totalLeakage > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-5 py-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {formatINR(t.totalLeakage)} agreed and never billed
            </span>{" "}
            across {t.leakingCount} {scope === "client" ? "client" : "service"}
            {t.leakingCount === 1 ? "" : "s"}. This is work the firm committed to and has
            not invoiced — it does not appear in receivables, because no invoice exists.
          </p>
        </div>
      )}

      <GlassCard hover={false} className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{scope === "client" ? "Client" : "Service"}</th>
                <th className="px-4 py-3 text-right font-medium">Agreed</th>
                <th className="px-4 py-3 text-right font-medium">Invoiced</th>
                <th className="px-4 py-3 text-right font-medium">Collected</th>
                <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                <th className="px-4 py-3 text-right font-medium">Leakage</th>
                <th className="px-4 py-3 text-right font-medium">Realisation</th>
              </tr>
            </thead>
            <tbody>
              {!report ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Working it out…
                  </td>
                </tr>
              ) : report.rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nothing agreed or invoiced in {report.financialYear}.
                  </td>
                </tr>
              ) : (
                report.rows.map((r) => (
                  <tr key={r.key} className="border-b border-white/[0.04] last:border-0">
                    <td className="max-w-56 truncate px-4 py-2.5">
                      {scope === "client" ? (
                        <Link href={`/clients/${r.key}`} className="hover:underline">
                          {r.label}
                        </Link>
                      ) : (
                        r.label
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.quoted == null ? "—" : formatINR(r.quoted)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(r.invoiced)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(r.collected)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {r.outstanding > 0 ? formatINR(r.outstanding) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {r.leakage && r.leakage > 0 ? (
                        <span className="text-amber-400">{formatINR(r.leakage)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${rateTone(r.realisationRate)}`}>
                      {pctText(r.realisationRate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <p className="px-1 text-xs text-muted-foreground">
        <IndianRupee className="mr-1 inline size-3" aria-hidden />
        Amounts exclude GST. Collected counts TDS the client deducted — it is money
        earned and received, just received by the government first. An agreed fee is
        annualised from its billing cadence, so a monthly retainer is compared against a
        year of invoices rather than one.
      </p>
    </div>
  )
}
