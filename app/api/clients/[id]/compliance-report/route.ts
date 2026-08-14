import { NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth/guards"
import { canAccessClientById } from "@/lib/auth/scope"
import { getFirmSettings, getFirmLogo } from "@/lib/firm-settings"
import { generateComplianceReportPDF, type ComplianceReportRow } from "@/lib/compliance/report-pdf"
import { prisma } from "@/lib/prisma"
import { checkApiRateLimit, getRateLimitHeaders } from "@/lib/security/rate-limiter"

/**
 * The client's compliance status, as a PDF.
 *
 * Only invoices and quotations could be printed, and both of those are
 * documents the client already has. The one a partner needs across a table at a
 * review meeting — what we file for you, what is done, what is coming, what is
 * late — existed only on screen.
 *
 * The window is the Indian financial year the request names (or the current
 * one), because that is the unit every conversation with a client is framed in.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()

  const rl = checkApiRateLimit(`pdf:${session.user.id}`)
  if (!rl.success) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: getRateLimitHeaders(rl),
    })
  }

  const { id } = await params

  // Staff only. A client viewing their own status has the portal, which is
  // live; this is the firm's document about the client, prepared and signed off
  // by a person, and it names who prepared it.
  if (session.user.role === "CLIENT") {
    return new NextResponse("Forbidden", { status: 403 })
  }
  if (!(await canAccessClientById(session, id))) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, clientCode: true, gstin: true, pan: true },
  })
  if (!client) return new NextResponse("Not found", { status: 404 })

  // Indian financial year: April to March, by law, whatever the client's books
  // do. `?fy=2025` means FY 2025-26.
  const url = new URL(request.url)
  const now = new Date()
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const fyParam = Number(url.searchParams.get("fy"))
  const fyStart =
    Number.isInteger(fyParam) && fyParam >= 2000 && fyParam <= currentFyStart + 1
      ? fyParam
      : currentFyStart

  const from = new Date(fyStart, 3, 1)
  const to = new Date(fyStart + 1, 2, 31, 23, 59, 59, 999)

  const events = await prisma.complianceEvent.findMany({
    where: { clientId: id, dueDate: { gte: from, lte: to } },
    orderBy: { dueDate: "asc" },
    select: {
      title: true,
      type: true,
      dueDate: true,
      status: true,
      completedAt: true,
      filingPeriod: true,
    },
  })

  // Acknowledgement numbers live on FilingRecord, which is where proof of
  // filing is kept — an event says it was done, a filing record says what the
  // portal issued when it was.
  const filings = await prisma.filingRecord.findMany({
    where: { clientId: id, financialYear: `${fyStart}-${String(fyStart + 1).slice(-2)}` },
    select: { filingType: true, period: true, acknowledgementNo: true, filedOn: true },
  })
  const ackByKey = new Map(
    filings
      .filter((f) => f.acknowledgementNo)
      .map((f) => [`${f.filingType}|${f.period ?? ""}`.toLowerCase(), f.acknowledgementNo!])
  )

  const toRow = (e: (typeof events)[number]): ComplianceReportRow => ({
    title: e.title,
    category: e.type,
    dueDate: e.dueDate,
    status: e.status,
    filedOn: e.completedAt,
    reference: ackByKey.get(`${e.title}|${e.filingPeriod ?? ""}`.toLowerCase()) ?? null,
  })

  // CANCELLED events are deliberately excluded: the firm has said the filing
  // does not apply, so listing it would invite a question with no answer.
  const live = events.filter((e) => e.status !== "CANCELLED")
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const filed = live.filter((e) => e.status === "COMPLETED").map(toRow)
  const overdue = live
    .filter((e) => e.status !== "COMPLETED" && e.dueDate < startOfToday)
    .map(toRow)
  const upcoming = live
    .filter((e) => e.status !== "COMPLETED" && e.dueDate >= startOfToday)
    .map(toRow)

  try {
    const [cfg, firmLogo] = await Promise.all([getFirmSettings(), getFirmLogo()])
    const pdf = await generateComplianceReportPDF({
      firmName: cfg.firmName,
      firmEmail: cfg.fromEmail || "",
      firmPhone: cfg.firmPhone || "",
      firmAddress: cfg.firmAddress || "",
      firmLogo,
      icaiFrn: cfg.icaiFrn,
      clientName: client.name,
      clientCode: client.clientCode,
      clientGstin: client.gstin,
      clientPan: client.pan,
      periodLabel: `FY ${fyStart}-${String(fyStart + 1).slice(-2)}  (Apr ${fyStart} – Mar ${fyStart + 1})`,
      generatedOn: now,
      preparedBy: session.user.name,
      filed,
      upcoming,
      overdue,
    })

    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Compliance-${client.clientCode}-FY${fyStart}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    })
  } catch (err) {
    console.error("Compliance report PDF generation error:", err)
    return new NextResponse("PDF generation failed", { status: 500 })
  }
}
