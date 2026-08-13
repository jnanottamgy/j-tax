import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateQuotationPDF } from "@/lib/quotations/pdf-generator"
import { getFirmSettingsForFirm, getFirmLogoForFirm } from "@/lib/firm-settings"
import { checkApiRateLimit, getRateLimitHeaders } from "@/lib/security/rate-limiter"

// Public, token-authenticated PDF download for the client quotation portal.
// No session — possession of the unguessable token IS the authorization.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // PDF generation is CPU-heavy — rate-limit per token to prevent an external
  // caller from exhausting the serverless function budget.
  const rl = checkApiRateLimit(`pdf-public:${token}`)
  if (!rl.success) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: getRateLimitHeaders(rl),
    })
  }

  const quotation = await prisma.quotation.findUnique({
    where: { token },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })

  if (!quotation) return new NextResponse("Not found", { status: 404 })

  try {
    // Public route — resolve branding from the quotation's own firm,
    // since there is no session to derive it from.
    const [cfg, firmLogo] = await Promise.all([
      getFirmSettingsForFirm(quotation.firmId),
      getFirmLogoForFirm(quotation.firmId),
    ])
    const pdfBuffer = await generateQuotationPDF({
      quotationNumber: quotation.quotationNumber,
      createdAt: quotation.createdAt,
      validUntil: quotation.validUntil,
      firmName: cfg.firmName,
      firmEmail: cfg.fromEmail || "",
      firmPhone: cfg.firmPhone || "",
      firmAddress: cfg.firmAddress || "",
      firmLogo,
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
    console.error("Public PDF generation error:", err)
    return new NextResponse("PDF generation failed", { status: 500 })
  }
}
