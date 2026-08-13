import { NextResponse, type NextRequest } from "next/server"
import * as XLSX from "xlsx"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import {
  getRevenueLedger,
  type RevenueFilters,
  type RevenueMetric,
  type RevenueRow,
} from "@/app/actions/revenue"

/**
 * Revenue ledger export.
 *
 * Honours exactly the filters shown on screen, so the file always matches the
 * table the user was looking at. XLSX ships four sheets (detail + the three
 * rollups) because a partner opening this in Excel wants to pivot immediately,
 * not rebuild the summaries by hand.
 */

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function fmtDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : DATE.format(d)
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

/**
 * A leading =, +, - or @ makes Excel/Sheets treat a cell as a formula. Client
 * names and remarks are user-supplied, so prefix a quote to neutralise it.
 */
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

/** Flat, human-readable shape — the header row is what lands in Excel. */
function toExportRow(r: RevenueRow) {
  return {
    "Invoice No": r.invoiceNumber,
    "Issue Date": fmtDate(r.issueDate),
    "Due Date": fmtDate(r.dueDate),
    Client: r.clientName,
    "Client Code": r.clientCode,
    "Client GSTIN": r.clientGstin ?? "",
    "Relationship Owner": r.assignedTo ?? "",
    "Service": r.serviceType ?? "",
    "Description": r.serviceDescription ?? "",
    "HSN/SAC": r.hsnSac ?? "",
    "Place of Supply": r.placeOfSupplyName ?? r.placeOfSupply ?? "",
    "Professional Fee": r.professionalFee ?? "",
    "Tax Rate %": r.taxRate ?? "",
    CGST: r.cgstAmount ?? "",
    SGST: r.sgstAmount ?? "",
    IGST: r.igstAmount ?? "",
    "Total Tax": r.taxAmount ?? "",
    "Invoice Total": r.amount,
    Received: r.paidAmount,
    Outstanding: r.outstandingAmount,
    Status: r.status,
    "Days Overdue": r.daysOverdue || "",
    "Last Payment": fmtDate(r.lastPaymentDate),
    "Payment Method": r.paymentMethods ?? "",
    "Payment Reference": r.paymentReferences ?? "",
    Revision: r.revisionNumber || "",
    "Revised From": r.revisedFromNumber ?? "",
    Remarks: r.remarks ?? "",
  }
}

function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as any
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}

export async function GET(request: NextRequest) {
  // Enforced here as well as in the action — the route must not rely on an
  // inner guard alone.
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
  const format = (sp.get("format") || "xlsx").toLowerCase()
  if (!["xlsx", "csv"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 })
  }

  const filters: RevenueFilters = {
    fy: sp.get("fy") || undefined,
    clientId: sp.get("clientId") || undefined,
    status: sp.get("status") || undefined,
    serviceType: sp.get("serviceType") || undefined,
    metric: (sp.get("metric") as RevenueMetric) || undefined,
  }

  try {
    const ledger = await getRevenueLedger(filters)
    const stamp = new Date().toISOString().slice(0, 10)
    const scope = ledger.applied.fy === "all" ? "all-time" : ledger.applied.fy
    const baseName = safeFileName(`revenue-${scope}-${stamp}`)

    const detail = ledger.rows.map(toExportRow)

    if (format === "csv") {
      // BOM so Excel reads UTF-8 (₹, client names) instead of mojibake.
      const csv = "﻿" + buildCsv(detail)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        },
      })
    }

    const wb = XLSX.utils.book_new()

    const detailSheet = XLSX.utils.json_to_sheet(
      detail.length ? detail : [{ Note: "No invoices match these filters" }]
    )
    XLSX.utils.book_append_sheet(wb, detailSheet, "Invoices")

    const summarySheet = XLSX.utils.json_to_sheet([
      { Metric: "Scope", Value: ledger.applied.label },
      { Metric: "Invoices", Value: ledger.summary.invoiceCount },
      { Metric: "Clients", Value: ledger.summary.clientCount },
      { Metric: "Professional fees", Value: ledger.summary.professionalFees },
      { Metric: "GST", Value: ledger.summary.tax },
      { Metric: "Total invoiced", Value: ledger.summary.invoiced },
      { Metric: "Received", Value: ledger.summary.collected },
      { Metric: "Outstanding", Value: ledger.summary.outstanding },
      { Metric: "Overdue", Value: ledger.summary.overdue },
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary")

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        ledger.byClient.map((r) => ({
          Client: r.label,
          Invoices: r.count,
          Amount: r.amount,
        }))
      ),
      "By Client"
    )

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        ledger.byService.map((r) => ({
          Service: r.label,
          Invoices: r.count,
          Amount: r.amount,
        }))
      ),
      "By Service"
    )

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        ledger.byMonth.map((r) => ({
          Month: r.label,
          Invoices: r.count,
          Amount: r.amount,
        }))
      ),
      "By Month"
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
    console.error("[revenue export] failed:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
