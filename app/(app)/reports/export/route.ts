import { NextResponse, type NextRequest } from "next/server"

import PDFDocument from "pdfkit"
import * as XLSX from "xlsx"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import {
  getClientReport,
  getComplianceReport,
  getEmployeeReport,
  getPaymentReport,
  type ReportFilters,
} from "@/app/actions/reports"

type ReportKey = "compliance" | "payments" | "employees" | "clients"
type FormatKey = "csv" | "xlsx" | "pdf"

function pickFilters(sp: URLSearchParams): ReportFilters {
  const get = (k: string) => sp.get(k) || undefined
  return {
    startDate: get("startDate"),
    endDate: get("endDate"),
    employeeId: get("employeeId"),
    clientId: get("clientId"),
    department: get("department"),
  }
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function buildCsv(rows: Array<Record<string, unknown>>) {
  const headers = Array.from(
    rows.reduce((acc, r) => {
      Object.keys(r).forEach((k) => acc.add(k))
      return acc
    }, new Set<string>())
  )
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ]
  return lines.join("\n")
}

function workbookToBuffer(wb: XLSX.WorkBook): Buffer {
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as any
  return Buffer.isBuffer(out) ? out : Buffer.from(out)
}

async function pdfBufferFromText(title: string, lines: string[]) {
  const doc = new PDFDocument({ margin: 40 })
  const chunks: Buffer[] = []
  doc.on("data", (c) => chunks.push(c as Buffer))

  doc.fontSize(18).text(title)
  doc.moveDown(0.5)
  doc.fontSize(10)
  for (const line of lines) {
    doc.text(line)
  }
  doc.end()

  await new Promise<void>((resolve) => doc.on("end", () => resolve()))
  return Buffer.concat(chunks)
}

export async function GET(request: NextRequest) {
  // MED-02: enforce auth at the route level — do not rely solely on inner action guards
  try {
    await requirePartnerOrManager()
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg.includes("Unauthorized")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const report = (url.searchParams.get("report") || "") as ReportKey
  const format = (url.searchParams.get("format") || "csv") as FormatKey

  if (!["compliance", "payments", "employees", "clients"].includes(report)) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 })
  }
  if (!["csv", "xlsx", "pdf"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 })
  }

  try {
  const filters = pickFilters(url.searchParams)
  const stamp = new Date().toISOString().slice(0, 10)
  const baseName = safeFileName(`${report}-report-${stamp}`)

  // Fetch report data (RBAC enforced inside actions via requirePartnerOrManager)
  const data =
    report === "compliance"
      ? await getComplianceReport(filters)
      : report === "payments"
        ? await getPaymentReport(filters)
        : report === "employees"
          ? await getEmployeeReport(filters)
          : await getClientReport(filters)

  if (format === "csv") {
    const rows =
      report === "compliance"
        ? [
            ...((data as any).overdue as any[]).map((r: any) => ({
              bucket: "overdue",
              client: r.client?.name ?? "",
              title: r.title,
              type: r.type,
              dueDate: r.dueDate,
              status: r.status,
            })),
            ...((data as any).upcoming as any[]).map((r: any) => ({
              bucket: "upcoming",
              client: r.client?.name ?? "",
              title: r.title,
              type: r.type,
              dueDate: r.dueDate,
              status: r.status,
            })),
          ]
        : report === "payments"
          ? [
              ...((data as any).outstandingInvoices as any[]).map((r: any) => ({
                bucket: "outstanding",
                invoiceNumber: r.invoiceNumber,
                client: r.client?.name ?? "",
                issueDate: r.issueDate,
                dueDate: r.dueDate,
                amount: r.amount,
                paidAmount: r.paidAmount,
                outstandingAmount: r.outstandingAmount,
                status: r.status,
              })),
              ...((data as any).paidInvoices as any[]).map((r: any) => ({
                bucket: "paid",
                invoiceNumber: r.invoiceNumber,
                client: r.client?.name ?? "",
                issueDate: r.issueDate,
                dueDate: r.dueDate,
                amount: r.amount,
                paidAmount: r.paidAmount,
                outstandingAmount: r.outstandingAmount,
                status: r.status,
              })),
            ]
          : report === "employees"
            ? ((data as any).employees as any[]).map((r: any) => ({
                employee: r.name,
                email: r.email,
                department: r.department ?? "",
                assigned: r.assigned,
                completed: r.completed,
                overdue: r.overdue,
                productivity: `${r.productivity}%`,
              }))
            : ((data as any).clients as any[]).map((r: any) => ({
                client: r.name,
                clientCode: r.clientCode,
                owner: r.assignedEmployeeName ?? "",
                complianceScore: r.complianceScore,
                outstandingPayments: r.outstandingPayments,
                openTasks: r.openTasks,
              }))

    const csv = buildCsv(rows)
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    })
  }

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new()

    const summary =
      report === "compliance"
        ? [
            ["total", (data as any).stats.total],
            ["upcoming", (data as any).stats.upcoming],
            ["overdue", (data as any).stats.overdue],
            ["completed", (data as any).stats.completed],
            ["completionRate", (data as any).stats.completionRate],
          ]
        : report === "payments"
          ? [
              ["totalInvoiced", (data as any).stats.totalInvoiced],
              ["totalCollected", (data as any).stats.totalCollected],
              ["totalOutstanding", (data as any).stats.totalOutstanding],
              ["invoiceCount", (data as any).stats.invoiceCount],
              ["collectionRate", (data as any).stats.collectionRate],
            ]
          : report === "employees"
            ? [["employees", ((data as any).employees as any[]).length]]
            : [["clients", ((data as any).clients as any[]).length]]

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["key", "value"], ...summary]),
      "Summary"
    )

    if (report === "compliance") {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet((data as any).overdue),
        "Overdue"
      )
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet((data as any).upcoming),
        "Upcoming"
      )
    } else if (report === "payments") {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet((data as any).outstandingInvoices),
        "Outstanding"
      )
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet((data as any).paidInvoices),
        "Paid"
      )
    } else if (report === "employees") {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet((data as any).employees),
        "Employees"
      )
    } else {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet((data as any).clients),
        "Clients"
      )
    }

    const buffer = workbookToBuffer(wb)
    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    })
  }

  // PDF
  const lines: string[] = []
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(
    `Filters: start=${filters.startDate ?? "-"} end=${filters.endDate ?? "-"} employee=${filters.employeeId ?? "-"} client=${filters.clientId ?? "-"} department=${filters.department ?? "-"}`
  )
  lines.push("")

  if (report === "compliance") {
    lines.push(
      `Completion rate: ${(data as any).stats.completionRate}% (completed ${(data as any).stats.completed}/${(data as any).stats.total})`
    )
    lines.push(`Overdue: ${(data as any).stats.overdue} • Upcoming: ${(data as any).stats.upcoming}`)
    lines.push("")
    lines.push("Overdue (top 15):")
    for (const r of ((data as any).overdue as any[]).slice(0, 15)) {
      lines.push(
        `- ${r.client?.name ?? "—"} | ${r.title} | due ${String(r.dueDate).slice(0, 10)}`
      )
    }
  } else if (report === "payments") {
    lines.push(`Collection rate: ${(data as any).stats.collectionRate}%`)
    lines.push(`Total invoiced: ${(data as any).stats.totalInvoiced}`)
    lines.push(`Collected: ${(data as any).stats.totalCollected}`)
    lines.push(`Outstanding: ${(data as any).stats.totalOutstanding}`)
    lines.push("")
    lines.push("Outstanding invoices (top 15):")
    for (const r of ((data as any).outstandingInvoices as any[]).slice(0, 15)) {
      lines.push(
        `- ${r.invoiceNumber} | ${r.client?.name ?? "—"} | due ${String(r.dueDate).slice(0, 10)} | outstanding ${r.outstandingAmount}`
      )
    }
  } else if (report === "employees") {
    lines.push(`Employees: ${((data as any).employees as any[]).length}`)
    lines.push("")
    for (const r of ((data as any).employees as any[]).slice(0, 25)) {
      lines.push(
        `- ${r.name} (${r.department ?? "—"}): completed ${r.completed}/${r.assigned}, overdue ${r.overdue}, productivity ${r.productivity}%`
      )
    }
  } else {
    lines.push(`Clients: ${((data as any).clients as any[]).length}`)
    lines.push("")
    for (const r of ((data as any).clients as any[]).slice(0, 25)) {
      lines.push(
        `- ${r.name}: compliance ${r.complianceScore}, outstanding ${r.outstandingPayments}, open tasks ${r.openTasks}`
      )
    }
  }

  const pdf = await pdfBufferFromText(
    `${report.toUpperCase()} Report`,
    lines
  )

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
    },
  })
  } catch (e) {
    console.error("[/reports/export]", e)
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 })
  }
}

