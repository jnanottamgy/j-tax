import { NextResponse, type NextRequest } from "next/server"
import * as XLSX from "xlsx"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { getInsight } from "@/app/actions/dashboard-insights"
import { INSIGHT_METRICS, type InsightMetric } from "@/lib/dashboard/insight-metrics"

/**
 * Export for any dashboard drill-down. Column definitions come from the same
 * action the page renders, so the file always matches what was on screen.
 */

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const VALID = INSIGHT_METRICS

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

/** Neutralise leading =, +, - and @ so Excel does not evaluate user text as a formula. */
function csvEscape(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function buildCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ].join("\n")
}

function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as any
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}

export async function GET(request: NextRequest) {
  try {
    await requirePartnerOrManager()
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    return NextResponse.json(
      { error: msg.includes("Unauthorized") ? "Unauthorized" : "Forbidden" },
      { status: msg.includes("Unauthorized") ? 401 : 403 }
    )
  }

  const sp = new URL(request.url).searchParams
  const metric = sp.get("metric") as InsightMetric | null
  const format = (sp.get("format") || "xlsx").toLowerCase()

  if (!metric || !VALID.includes(metric)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 })
  }
  if (!["xlsx", "csv"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 })
  }

  try {
    const insight = await getInsight(metric)

    // Header row uses the on-screen labels, and dates are rendered rather than
    // exported as ISO strings — this file is read by people, not parsers.
    const detail = insight.rows.map((r) => {
      const out: Record<string, string | number> = {}
      for (const col of insight.columns) {
        const raw = r.cells[col.key]
        if (raw === null || raw === undefined) {
          out[col.label] = ""
        } else if (col.type === "date") {
          const d = new Date(String(raw))
          out[col.label] = Number.isNaN(d.getTime()) ? String(raw) : DATE.format(d)
        } else {
          out[col.label] = raw
        }
      }
      return out
    })

    const stamp = new Date().toISOString().slice(0, 10)
    const baseName = safeFileName(`${metric}-${stamp}`)

    if (format === "csv") {
      // BOM so Excel reads UTF-8 rather than mojibake.
      const csv = "﻿" + buildCsv(detail)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        },
      })
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        detail.length ? detail : [{ Note: "No records behind this metric" }]
      ),
      "Detail"
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        insight.summary.map((s) => ({ Metric: s.label, Value: s.value }))
      ),
      "Summary"
    )

    const buf = workbookToBuffer(wb)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("[insight export] failed:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
