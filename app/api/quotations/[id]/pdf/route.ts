import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { generateQuotationPDF } from "@/lib/quotations/pdf-generator"
import { getFirmSettings } from "@/lib/firm-settings"
import { checkApiRateLimit, getRateLimitHeaders } from "@/lib/security/rate-limiter"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !["PARTNER", "MANAGER"].includes(session.user.role)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  // PDF generation is CPU-heavy — rate-limit per user to prevent a single
  // authenticated caller from exhausting the serverless function budget.
  const rl = checkApiRateLimit(`pdf:${session.user.id}`)
  if (!rl.success) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: getRateLimitHeaders(rl),
    })
  }

  const { id } = await params
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })

  if (!quotation) return new NextResponse("Not found", { status: 404 })

  try {
    const cfg = await getFirmSettings()
    const pdfBuffer = await generateQuotationPDF({
      quotationNumber: quotation.quotationNumber,
      createdAt: quotation.createdAt,
      validUntil: quotation.validUntil,
      firmName: cfg.firmName,
      firmEmail: cfg.fromEmail || "",
      firmPhone: cfg.firmPhone || "",
      firmAddress: cfg.firmAddress || "",
      clientName: quotation.clientName,
      clientEmail: quotation.clientEmail,
      clientPhone: quotation.clientPhone,
      clientCompany: quotation.clientCompany,
      items: quotation.items.map((i) => ({
        description: i.description,
        serviceType: i.serviceType,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        taxRate: Number(i.taxRate),
        taxAmount: Number(i.taxAmount),
        total: Number(i.total),
      })),
      subtotal: Number(quotation.subtotal),
      taxAmount: Number(quotation.taxAmount),
      total: Number(quotation.total),
      notes: quotation.notes,
      terms: quotation.terms,
    })

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quotation-${quotation.quotationNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error("PDF generation error:", err)
    return new NextResponse("PDF generation failed", { status: 500 })
  }
}
