import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { generateQuotationPDF } from "@/lib/quotations/pdf-generator"

const FIRM_NAME = process.env.FIRM_NAME || "TaxWise Consultants"
const FIRM_EMAIL = process.env.FROM_EMAIL || "noreply@taxwiseconsultants.com"
const FIRM_PHONE = process.env.FIRM_PHONE || "+91-XXXXXXXXXX"
const FIRM_ADDRESS = process.env.FIRM_ADDRESS || "India"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || !["PARTNER", "MANAGER"].includes(session.user.role)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { id } = await params
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })

  if (!quotation) return new NextResponse("Not found", { status: 404 })

  try {
    const pdfBuffer = await generateQuotationPDF({
      quotationNumber: quotation.quotationNumber,
      createdAt: quotation.createdAt,
      validUntil: quotation.validUntil,
      firmName: FIRM_NAME,
      firmEmail: FIRM_EMAIL,
      firmPhone: FIRM_PHONE,
      firmAddress: FIRM_ADDRESS,
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
