"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Download, FileSpreadsheet, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { formatINR } from "@/lib/india/format"
import type { Insight, InsightColumn } from "@/lib/dashboard/insight-metrics"
import { cn } from "@/lib/utils"

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "text-emerald-400",
  PAID: "text-emerald-400",
  ACCEPTED: "text-emerald-400",
  WON: "text-emerald-400",
  PENDING: "text-amber-400",
  PENDING_APPROVAL: "text-amber-400",
  SENT: "text-blue-400",
  VIEWED: "text-blue-400",
  OVERDUE: "text-red-400",
  REJECTED: "text-red-400",
  LOST: "text-red-400",
  CANCELLED: "text-muted-foreground",
}

/** Renders one cell according to its column type. */
function renderCell(col: InsightColumn, value: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/50">—</span>
  }

  switch (col.type) {
    case "currency":
      return <span className="tabular-nums">{formatINR(Number(value))}</span>
    case "number":
      return <span className="tabular-nums">{value}</span>
    case "danger":
      // Only ever populated when there is something wrong, so always flag it.
      return <span className="tabular-nums font-medium text-red-400">{value}</span>
    case "date": {
      const d = new Date(String(value))
      return (
        <span className="text-muted-foreground">
          {Number.isNaN(d.getTime()) ? String(value) : DATE.format(d)}
        </span>
      )
    }
    case "status": {
      const key = String(value).toUpperCase().replace(/ /g, "_")
      return (
        <span className={cn("font-medium", STATUS_TONE[key] ?? "text-muted-foreground")}>
          {String(value).replace(/_/g, " ")}
        </span>
      )
    }
    default:
      return <span>{String(value)}</span>
  }
}

function isNumericCol(col: InsightColumn) {
  return col.type === "currency" || col.type === "number" || col.type === "danger"
}

export function InsightDetailClient({ insight }: { insight: Insight }) {
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return insight.rows
    return insight.rows.filter((r) =>
      Object.values(r.cells).some((v) => String(v ?? "").toLowerCase().includes(q))
    )
  }, [insight.rows, query])

  const exportHref = (format: "xlsx" | "csv") =>
    `/reports/insights/export?metric=${insight.metric}&format=${format}`

  return (
    <div className="space-y-6">
      <PageHeader
        label="Dashboard detail"
        title={insight.title}
        description={insight.description}
        backHref="/"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
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
        {insight.summary.map((s) => {
          // Money-ish summaries arrive as raw numbers so the server never has
          // to guess a locale; format them here.
          const numeric = /^-?\d+(\.\d+)?$/.test(s.value)
          const isMoney = /value|₹|pipeline|held up|stake/i.test(s.label)
          return (
            <Card key={s.label} className="border-white/[0.08] bg-white/[0.02]">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {numeric && isMoney ? formatINR(Number(s.value)) : s.value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* ── Detail ──────────────────────────────────────────────────────── */}
      <Card className="border-white/[0.08] bg-white/[0.02]">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search these records…"
                className="h-9 rounded-xl pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {rows.length} of {insight.rows.length}
            </p>
          </div>

          {insight.rows.length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon={FileSpreadsheet}
                title="Nothing to show"
                description="There are no records behind this metric right now — which is usually good news."
              />
            </div>
          ) : (
            // Wide tables scroll inside their own container so the page never
            // scrolls sideways.
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-white/[0.08]">
                  <tr className="text-left text-xs text-muted-foreground">
                    {insight.columns.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        className={cn(
                          "px-3 py-2.5 font-medium",
                          isNumericCol(c) && "text-right"
                        )}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]"
                    >
                      {insight.columns.map((c, i) => {
                        const content = renderCell(c, r.cells[c.key] ?? null)
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "px-3 py-2.5 align-top",
                              isNumericCol(c) && "text-right"
                            )}
                          >
                            {/* Only the first column links, so the row stays
                                scannable without a wall of blue text. */}
                            {i === 0 && r.href ? (
                              <Link href={r.href} className="font-medium hover:text-primary">
                                {content}
                              </Link>
                            ) : (
                              content
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing matches “{query}”.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
