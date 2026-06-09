import PDFDocument from "pdfkit"

export interface QuotationPDFData {
  quotationNumber: string
  createdAt: Date
  validUntil: Date
  firmName: string
  firmEmail: string
  firmPhone: string
  firmAddress: string
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
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    doc
      .rect(50, 50, pageWidth, 80)
      .fill(BRAND)

    doc
      .fillColor("white")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(data.firmName, 70, 65)

    doc
      .fontSize(9)
      .font("Helvetica")
      .text(`${data.firmEmail}  |  ${data.firmPhone}`, 70, 92)
      .text(data.firmAddress, 70, 106)

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

    // ── Items Table Header ─────────────────────────────────────────────────────
    const tableY = 290
    const colWidths = { desc: 220, qty: 50, price: 90, tax: 70, total: 85 }
    const colX = {
      desc: 50,
      qty: 270,
      price: 320,
      tax: 410,
      total: 480,
    }

    doc.rect(50, tableY, pageWidth, 20).fill(BRAND)

    doc
      .fillColor("white")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("DESCRIPTION", colX.desc + 4, tableY + 6)
      .text("QTY", colX.qty, tableY + 6, { width: colWidths.qty, align: "center" })
      .text("UNIT PRICE", colX.price, tableY + 6, { width: colWidths.price, align: "right" })
      .text("GST", colX.tax, tableY + 6, { width: colWidths.tax, align: "right" })
      .text("TOTAL", colX.total, tableY + 6, { width: colWidths.total, align: "right" })

    // ── Items ─────────────────────────────────────────────────────────────────
    let rowY = tableY + 20
    data.items.forEach((item, i) => {
      const rowBg = i % 2 === 0 ? "#ffffff" : "#f9fafb"
      const estimatedRowH = 32

      doc.rect(50, rowY, pageWidth, estimatedRowH).fill(rowBg)

      doc
        .fillColor(DARK)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(item.description, colX.desc + 4, rowY + 6, { width: colWidths.desc - 8 })

      if (item.serviceType) {
        doc
          .fillColor(GRAY)
          .fontSize(8)
          .font("Helvetica")
          .text(item.serviceType, colX.desc + 4, rowY + 18, { width: colWidths.desc - 8 })
      }

      doc
        .fillColor(DARK)
        .fontSize(9)
        .font("Helvetica")
        .text(String(item.quantity), colX.qty, rowY + 12, { width: colWidths.qty, align: "center" })
        .text(formatCurrency(item.unitPrice), colX.price, rowY + 12, { width: colWidths.price, align: "right" })
        .text(`${item.taxRate}%`, colX.tax, rowY + 12, { width: colWidths.tax, align: "right" })
        .text(formatCurrency(item.total), colX.total, rowY + 12, { width: colWidths.total, align: "right" })

      // bottom border
      doc.moveTo(50, rowY + estimatedRowH).lineTo(50 + pageWidth, rowY + estimatedRowH).strokeColor(BORDER).lineWidth(0.5).stroke()

      rowY += estimatedRowH
    })

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalsX = 390
    const totalsW = pageWidth + 50 - totalsX
    rowY += 10

    doc
      .fillColor(GRAY)
      .fontSize(9)
      .font("Helvetica")
      .text("Subtotal", totalsX, rowY, { width: totalsW - 80 })
      .fillColor(DARK)
      .text(formatCurrency(data.subtotal), totalsX, rowY, { width: totalsW, align: "right" })

    rowY += 16
    doc
      .fillColor(GRAY)
      .text("GST / Tax", totalsX, rowY, { width: totalsW - 80 })
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
      .text("TOTAL", totalsX, rowY + 8, { width: totalsW - 80 })
      .text(formatCurrency(data.total), totalsX, rowY + 8, { width: totalsW, align: "right" })

    rowY += 50

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
    const defaultTerms = data.terms ||
      "1. This quotation is valid for 30 days from the date of issue.\n" +
      "2. 50% advance payment required to commence services.\n" +
      "3. Prices are exclusive of GST unless stated.\n" +
      "4. Work commences upon receipt of signed acceptance."

    doc
      .fillColor(BRAND)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("TERMS & CONDITIONS", 50, rowY)
    doc
      .fillColor(GRAY)
      .fontSize(8)
      .font("Helvetica")
      .text(defaultTerms, 50, rowY + 14, { width: pageWidth })

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
