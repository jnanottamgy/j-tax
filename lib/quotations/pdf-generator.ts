import PDFDocument from "pdfkit"

import { amountInWords, DEFAULT_QUOTATION_TERMS } from "@/lib/quotations/terms"
import { formatIndianNumber } from "@/lib/india/format"
import { drawLetterhead, type PdfLogo } from "@/lib/pdf/letterhead"

export interface QuotationPDFData {
  quotationNumber: string
  createdAt: Date
  validUntil: Date
  firmName: string
  firmEmail: string
  firmPhone: string
  firmAddress: string
  /** Firm letterhead. Omitted or null → the wordmark-only header. */
  firmLogo?: PdfLogo | null
  clientName: string
  clientEmail: string
  clientPhone: string | null
  clientCompany: string | null
  items: Array<{
    description: string
    serviceType: string | null
    quantity: number
    unitPrice: number
    taxRate: number
    taxAmount: number
    total: number
  }>
  subtotal: number
  taxAmount: number
  total: number
  notes: string | null
  terms: string | null
}

const BRAND = "#1e3a8a"
const BRAND_LIGHT = "#dbeafe"
const GRAY = "#6b7280"
const DARK = "#111827"
const BORDER = "#e5e7eb"

function formatCurrency(amount: number): string {
  return `₹${formatIndianNumber(amount, { paise: true })}`
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export async function generateQuotationPDF(data: QuotationPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width - 100 // margins

    // ── Header ──────────────────────────────────────────────────────────────
    drawLetterhead(doc, {
      x: 50,
      y: 50,
      width: pageWidth,
      height: 80,
      bandColor: BRAND,
      logo: data.firmLogo,
      firmName: data.firmName,
      lines: [
        [data.firmEmail, data.firmPhone].filter(Boolean).join("  |  "),
        data.firmAddress,
      ],
      // "QUOTATION" at 28pt plus the number beneath it.
      titleReserve: 190,
    })

    doc
      .fillColor("white")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("QUOTATION", 0, 75, { align: "right", width: doc.page.width - 70 })

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`#${data.quotationNumber}`, 0, 108, { align: "right", width: doc.page.width - 70 })

    // ── Info bar ─────────────────────────────────────────────────────────────
    const infoY = 148
    doc.rect(50, infoY, pageWidth, 36).fill(BRAND_LIGHT)

    doc
      .fillColor(BRAND)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("DATE ISSUED", 70, infoY + 8)
      .text("VALID UNTIL", 230, infoY + 8)
      .text("STATUS", 390, infoY + 8)

    doc
      .fillColor(DARK)
      .font("Helvetica")
      .text(formatDate(data.createdAt), 70, infoY + 20)
      .text(formatDate(data.validUntil), 230, infoY + 20)
      .text("Awaiting Acceptance", 390, infoY + 20)

    // ── Bill To ───────────────────────────────────────────────────────────────
    const billY = 206
    doc
      .fillColor(BRAND)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("BILL TO", 70, billY)

    doc
      .fillColor(DARK)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(data.clientCompany || data.clientName, 70, billY + 14)

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(GRAY)
      .text(data.clientName, 70, billY + 28)
      .text(data.clientEmail, 70, billY + 40)

    if (data.clientPhone) {
      doc.text(data.clientPhone, 70, billY + 52)
    }

    // ── Professional services table ───────────────────────────────────────────
    // Service-based billing: no quantity column — each line is an engagement
    // with a professional fee.
    const tableY = 290
    const colWidths = { num: 24, desc: 246, fee: 100, tax: 55, total: 95 }
    const colX = {
      num: 50,
      desc: 74,
      fee: 320,
      tax: 420,
      total: 475,
    }

    doc.rect(50, tableY, pageWidth, 20).fill(BRAND)

    doc
      .fillColor("white")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("#", colX.num + 4, tableY + 6)
      .text("PROFESSIONAL SERVICES", colX.desc, tableY + 6)
      .text("FEE", colX.fee, tableY + 6, { width: colWidths.fee, align: "right" })
      .text("GST", colX.tax, tableY + 6, { width: colWidths.tax, align: "right" })
      .text("AMOUNT", colX.total, tableY + 6, { width: colWidths.total, align: "right" })

    // ── Items ─────────────────────────────────────────────────────────────────
    let rowY = tableY + 20
    data.items.forEach((item, i) => {
      const rowBg = i % 2 === 0 ? "#ffffff" : "#f9fafb"
      const descH = doc.heightOfString(item.description, { width: colWidths.desc - 8 })
      const estimatedRowH = Math.max(32, descH + (item.serviceType ? 24 : 14))
      const fee = item.quantity * item.unitPrice

      doc.rect(50, rowY, pageWidth, estimatedRowH).fill(rowBg)

      doc
        .fillColor(GRAY)
        .fontSize(9)
        .font("Helvetica")
        .text(String(i + 1), colX.num + 4, rowY + 8)

      doc
        .fillColor(DARK)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(item.description, colX.desc, rowY + 8, { width: colWidths.desc - 8 })

      if (item.serviceType) {
        doc
          .fillColor(GRAY)
          .fontSize(8)
          .font("Helvetica")
          .text(item.serviceType, colX.desc, rowY + 8 + descH + 2, { width: colWidths.desc - 8 })
      }

      doc
        .fillColor(DARK)
        .fontSize(9)
        .font("Helvetica")
        .text(formatCurrency(fee), colX.fee, rowY + 8, { width: colWidths.fee, align: "right" })
        .text(`${item.taxRate}%`, colX.tax, rowY + 8, { width: colWidths.tax, align: "right" })
        .font("Helvetica-Bold")
        .text(formatCurrency(item.total), colX.total, rowY + 8, { width: colWidths.total, align: "right" })

      // bottom border
      doc.moveTo(50, rowY + estimatedRowH).lineTo(50 + pageWidth, rowY + estimatedRowH).strokeColor(BORDER).lineWidth(0.5).stroke()

      rowY += estimatedRowH
    })

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalsX = 370
    const totalsW = pageWidth + 50 - totalsX
    rowY += 10

    doc
      .fillColor(GRAY)
      .fontSize(9)
      .font("Helvetica")
      .text("Professional Fees", totalsX, rowY, { width: totalsW - 100 })
      .fillColor(DARK)
      .text(formatCurrency(data.subtotal), totalsX, rowY, { width: totalsW, align: "right" })

    rowY += 16
    doc
      .fillColor(GRAY)
      .text("GST", totalsX, rowY, { width: totalsW - 100 })
      .fillColor(DARK)
      .text(formatCurrency(data.taxAmount), totalsX, rowY, { width: totalsW, align: "right" })

    rowY += 10
    doc.moveTo(totalsX, rowY).lineTo(50 + pageWidth, rowY).strokeColor(BORDER).lineWidth(1).stroke()
    rowY += 10

    doc.rect(totalsX - 10, rowY, totalsW + 10, 26).fill(BRAND)
    doc
      .fillColor("white")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("TOTAL", totalsX, rowY + 8, { width: totalsW - 100 })
      .text(formatCurrency(data.total), totalsX, rowY + 8, { width: totalsW, align: "right" })

    rowY += 32

    // Amount in words — standard on Indian engagement documents
    doc
      .fillColor(GRAY)
      .fontSize(8)
      .font("Helvetica-Oblique")
      .text(amountInWords(data.total), 50, rowY, { width: pageWidth, align: "right" })

    rowY += 24

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (data.notes) {
      doc
        .fillColor(BRAND)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("NOTES", 50, rowY)
      doc
        .fillColor(DARK)
        .fontSize(9)
        .font("Helvetica")
        .text(data.notes, 50, rowY + 14, { width: pageWidth })
      rowY += 14 + doc.heightOfString(data.notes, { width: pageWidth }) + 16
    }

    // ── Terms ─────────────────────────────────────────────────────────────────
    const termsText = data.terms || DEFAULT_QUOTATION_TERMS

    doc
      .fillColor(BRAND)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("TERMS & CONDITIONS", 50, rowY)
    doc
      .fillColor(GRAY)
      .fontSize(8)
      .font("Helvetica")
      .text(termsText, 50, rowY + 14, { width: pageWidth })

    rowY += 14 + doc.heightOfString(termsText, { width: pageWidth }) + 24

    // ── Signatures ────────────────────────────────────────────────────────────
    // Keep both blocks above the footer; push to footer zone if content is short.
    const signY = Math.min(Math.max(rowY, doc.page.height - 180), doc.page.height - 180)

    // Client acceptance (left)
    doc
      .strokeColor(DARK)
      .lineWidth(0.75)
      .moveTo(50, signY + 48)
      .lineTo(230, signY + 48)
      .stroke()
    doc
      .fillColor(DARK)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("Client Acceptance", 50, signY + 54)
    doc
      .fillColor(GRAY)
      .font("Helvetica")
      .text("Signature & Date", 50, signY + 64)

    // Authorised signatory (right)
    doc
      .fillColor(DARK)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(`For ${data.firmName}`, 50 + pageWidth - 200, signY - 6, { width: 200, align: "right" })
    doc
      .strokeColor(DARK)
      .lineWidth(0.75)
      .moveTo(50 + pageWidth - 180, signY + 48)
      .lineTo(50 + pageWidth, signY + 48)
      .stroke()
    doc
      .fillColor(DARK)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("Authorised Signatory", 50 + pageWidth - 200, signY + 54, { width: 200, align: "right" })
    doc
      .fillColor(GRAY)
      .font("Helvetica")
      .text("Name, Signature & Seal", 50 + pageWidth - 200, signY + 64, { width: 200, align: "right" })

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 60
    doc
      .moveTo(50, footerY)
      .lineTo(50 + pageWidth, footerY)
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .stroke()

    doc
      .fillColor(GRAY)
      .fontSize(8)
      .font("Helvetica")
      .text(
        `This is a computer-generated quotation from ${data.firmName}. For queries, contact ${data.firmEmail}`,
        50,
        footerY + 8,
        { align: "center", width: pageWidth }
      )

    doc.end()
  })
}
