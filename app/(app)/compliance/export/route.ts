import { NextResponse, type NextRequest } from "next/server"

import * as XLSX from "xlsx"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { getComplianceEvents } from "@/app/actions/compliance"

/**
 * Compliance Operations export (PARTNER/MANAGER only).
 *   /compliance/export?format=csv|xlsx&scope=all|completed|overdue
 * Serializes the firm's compliance events. Runs through the tenant-scoped
 * Prisma client via getComplianceEvents, so it only ever sees this firm.
 */

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  try {
    await requirePartnerOrManager()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const format = (sp.get("format") || "csv").toLowerCase()
  const scope = (sp.get("scope") || "all").toLowerCase()

  const { events } = await getComplianceEvents()
  const now = new Date()

  const isOverdue = (e: (typeof events)[number]) =>
    e.status === "OVERDUE" ||
    (e.status !== "COMPLETED" && e.dueDate != null && new Date(e.dueDate) < now)

  const filtered = events.filter((e) => {
    if (scope === "completed") return e.status === "COMPLETED"
    if (scope === "overdue") return isOverdue(e)
    return true
  })

  const rows = filtered.map((e) => ({
    Client: e.client?.name ?? "",
    Title: e.title,
    Type: e.type,
    "Filing Period": e.filingPeriod ?? "",
    "Due Date": fmtDate(e.dueDate),
    Status: e.status,
    "Completed On": fmtDate(e.completedAt),
    Task: e.task?.title ?? "",
  }))

  const headers = [
    "Client",
    "Title",
    "Type",
    "Filing Period",
    "Due Date",
    "Status",
    "Completed On",
    "Task",
  ]
  const scopeLabel = scope === "completed" ? "completed" : scope === "overdue" ? "overdue" : "all"
  const baseName = `compliance-events-${scopeLabel}`

  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Compliance")
    const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
    const buf = Buffer.isBuffer(out) ? out : Buffer.from(out)
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    })
  }

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(",")),
  ].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
    },
  })
}
