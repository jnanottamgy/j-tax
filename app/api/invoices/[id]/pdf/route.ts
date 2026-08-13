import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth/session"
import { getFirmSettings, getFirmLogo } from "@/lib/firm-settings"
import { generateInvoicePDF } from "@/lib/invoices/pdf-generator"
import { prisma } from "@/lib/prisma"
import { checkApiRateLimit, getRateLimitHeaders } from "@/lib/security/rate-limiter"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  // PDF generation is CPU-heavy — rate-limit per user.
  const rl = checkApiRateLimit(`pdf:${session.user.id}`)
  if (!rl.success) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: getRateLimitHeaders(rl),
    })
  }

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: {
        select: { name: true, email: true, gstin: true, address: true },
      },
      payments: { orderBy: { paymentDate: "desc" } },
    },
  })

  if (!invoice) return new NextResponse("Not found", { status: 404 })

  // Invoices are a PARTNER/MANAGER feature (EMPLOYEE is blocked from the whole
  // payments module). CLIENT users may download only their own invoice,
  // matched the same way the portal resolves its client record (by login email).
  const role = session.user.role
  if (role === "CLIENT") {
    if (
      !invoice.client.email ||
      invoice.client.email.toLowerCase() !== session.user.email.toLowerCase()
    ) {
      return new NextResponse("Forbidden", { status: 403 })
    }
  } else if (!["PARTNER", "MANAGER"].includes(role)) {
    // Prevents an EMPLOYEE (or any non-billing role) from pulling any invoice
    // PDF by id — an IDOR that leaked client PII, fees, and bank details.
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    const [cfg, firmLogo] = await Promise.all([getFirmSettings(), getFirmLogo()])
    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      firmName: cfg.firmName,
      firmEmail: cfg.fromEmail || "",
      firmPhone: cfg.firmPhone || "",
      firmAddress: cfg.firmAddress || "",
      firmGstin: cfg.gstin,
      firmLogo,
      clientName: invoice.client.name,
      clientEmail: invoice.client.email,
      clientGstin: invoice.client.gstin,
      clientAddress: invoice.client.address,
      amount: Number(invoice.amount),
      paidAmount: Number(invoice.paidAmount),
      outstandingAmount: Number(invoice.outstandingAmount),
      serviceDescription: invoice.serviceDescription,
      serviceType: invoice.serviceType,
      professionalFee:
        invoice.professionalFee !== null ? Number(invoice.professionalFee) : null,
      taxRate: invoice.taxRate !== null ? Number(invoice.taxRate) : null,
      taxAmount: invoice.taxAmount !== null ? Number(invoice.taxAmount) : null,
      remarks: invoice.remarks,
      payments: invoice.payments.map((p) => ({
        amount: Number(p.amount),
        paymentDate: p.paymentDate,
        method: p.method,
        reference: p.reference,
      })),
      paymentDetails: {
        bankName: cfg.bankName,
        bankAccountName: cfg.bankAccountName,
        bankAccountNumber: cfg.bankAccountNumber,
        bankIfsc: cfg.bankIfsc,
        upiId: cfg.upiId,
      },
    })

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error("Invoice PDF generation error:", err)
    return new NextResponse("PDF generation failed", { status: 500 })
  }
}
