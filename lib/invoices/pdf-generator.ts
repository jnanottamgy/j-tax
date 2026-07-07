import PDFDocument from "pdfkit"

import { stateName } from "@/lib/invoices/gst"
import { formatIndianNumber } from "@/lib/india/format"

export interface InvoicePDFData {
  invoiceNumber: string
  issueDate: Date
  dueDate: Date
  status: string
  firmName: string
  firmEmail: string
  firmPhone: string
  firmAddress: string
  firmGstin: string | null
  clientName: string
  clientEmail: string | null
  clientGstin: string | null
  clientAddress: string | null
  amount: number
  paidAmount: number
  outstandingAmount: number
  // Service-based billing breakdown (older invoices may not have these)
  serviceDescription?: string | null
  serviceType?: string | null
  professionalFee?: number | null
  taxRate?: number | null
  taxAmount?: number | null
  // GST tax-invoice fields (null on legacy invoices → plain "GST @ x%" line)
  placeOfSupply?: string | null
  hsnSac?: string | null
  cgstAmount?: number | null
  sgstAmount?: number | null
  igstAmount?: number | null
  remarks?: string | null
  payments: Array<{
    amount: number
    paymentDate: Date
    method: string | null
    reference: string | null
  }>
  paymentDetails: {
    bankName: string | null
    bankAccountName: string | null
    bankAccountNumber: string | null
    bankIfsc: string | null
    upiId: string | null
  }
}

const BRAND = "#1e3a8a"
const GRAY = "#6b7280"
const DARK = "#111827"
const BORDER = "#e5e7eb"

// "Rs." (not ₹) — PDFKit's built-in Helvetica has no rupee glyph.
function formatCurrency(amount: number): string {
  return `Rs. ${formatIndianNumber(amount, { paise: true })}`
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    const chunks: Buffer[] = []

    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width - 100

    // A GST-compliant document is titled "TAX INVOICE"; legacy invoices
    // without GST data keep the plain "INVOICE" heading.
    const hasGstData =
      data.placeOfSupply != null ||
      data.cgstAmount != null ||
      data.sgstAmount != null ||
      data.igstAmount != null

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(50, 50, pageWidth, 80).fill(BRAND)
    doc
      .fillColor("white")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(data.firmName, 70, 65)
    doc
      .fontSize(9)
      .font("Helvetica")
      .text([data.firmEmail, data.firmPhone].filter(Boolean).join("  |  "), 70, 92)
      .text(data.firmAddress ?? "", 70, 106)
    doc
      .fontSize(hasGstData ? 20 : 24)
      .font("Helvetica-Bold")
      .text(hasGstData ? "TAX INVOICE" : "INVOICE", 50, hasGstData ? 74 : 72, {
        width: pageWidth - 20,
        align: "right",
      })

    let y = 155

    // ── Meta block ──────────────────────────────────────────────────────────
    doc.fillColor(GRAY).fontSize(9).font("Helvetica")
    doc.text("Invoice No.", 50, y)
    doc.text("Issue Date", 200, y)
    doc.text("Due Date", 330, y)
    doc.text("Status", 460, y)

    doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold")
    doc.text(`#${data.invoiceNumber}`, 50, y + 14)
    doc.text(formatDate(data.issueDate), 200, y + 14)
    doc.text(formatDate(data.dueDate), 330, y + 14)
    doc.text(data.status.replace(/_/g, " "), 460, y + 14)

    y += 50

    // ── Billed To ───────────────────────────────────────────────────────────
    doc.fillColor(GRAY).fontSize(9).font("Helvetica").text("BILLED TO", 50, y)
    doc
      .fillColor(DARK)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(data.clientName, 50, y + 14)
    let clientLine = y + 30
    doc.fontSize(9).font("Helvetica").fillColor(GRAY)
    if (data.clientEmail) {
      doc.text(data.clientEmail, 50, clientLine)
      clientLine += 12
    }
    if (data.clientGstin) {
      doc.text(`GSTIN: ${data.clientGstin}`, 50, clientLine)
      clientLine += 12
    }
    if (data.clientAddress) {
      doc.text(data.clientAddress, 50, clientLine, { width: 250 })
      clientLine += 24
    }
    if (data.placeOfSupply) {
      const posName = stateName(data.placeOfSupply)
      doc.text(
        `Place of Supply: ${posName ? `${posName} (${data.placeOfSupply})` : data.placeOfSupply}`,
        50,
        clientLine
      )
      clientLine += 12
    }
    if (data.firmGstin) {
      doc.text(`Firm GSTIN: ${data.firmGstin}`, 330, y + 14)
    }

    y = Math.max(clientLine, y + 60) + 10

    // ── Professional services table ─────────────────────────────────────────
    doc.rect(50, y, pageWidth, 24).fill(BRAND)
    doc
      .fillColor("white")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("Professional Services", 60, y + 7)
      .text("Amount", 50, y + 7, { width: pageWidth - 20, align: "right" })
    y += 24

    const hasFeeBreakdown =
      data.professionalFee !== null && data.professionalFee !== undefined

    // Service line: description (+ type) with the professional fee.
    // HSN/SAC rides along on its own line inside the same row.
    const serviceLabel =
      data.serviceDescription ||
      (data.serviceType
        ? data.serviceType.replace(/_/g, " ")
        : "Professional services rendered")
    const serviceText = data.hsnSac
      ? `${serviceLabel}\nHSN/SAC: ${data.hsnSac}`
      : serviceLabel
    const serviceLabelH = doc.heightOfString(serviceText, {
      width: pageWidth - 160,
    })
    const serviceRowH = Math.max(24, serviceLabelH + 14)
    doc
      .fillColor(DARK)
      .fontSize(10)
      .font("Helvetica")
      .text(serviceText, 60, y + 7, { width: pageWidth - 160 })
      .text(
        formatCurrency(hasFeeBreakdown ? Number(data.professionalFee) : data.amount),
        50,
        y + 7,
        { width: pageWidth - 20, align: "right" }
      )
    doc
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .moveTo(50, y + serviceRowH)
      .lineTo(50 + pageWidth, y + serviceRowH)
      .stroke()
    y += serviceRowH

    const rows: Array<[string, string, boolean]> = []
    if (hasFeeBreakdown) {
      const rateKnown = data.taxRate !== null && data.taxRate !== undefined
      if (data.cgstAmount != null && data.sgstAmount != null) {
        // Intra-state supply: GST split equally into CGST + SGST.
        const halfRate = rateKnown ? ` @ ${Number(data.taxRate) / 2}%` : ""
        rows.push([`CGST${halfRate}`, formatCurrency(data.cgstAmount), false])
        rows.push([`SGST${halfRate}`, formatCurrency(data.sgstAmount), false])
      } else if (data.igstAmount != null) {
        // Inter-state supply: the full GST amount is IGST.
        rows.push([
          `IGST${rateKnown ? ` @ ${Number(data.taxRate)}%` : ""}`,
          formatCurrency(data.igstAmount),
          false,
        ])
      } else {
        // Legacy invoices without a persisted split.
        rows.push([
          `GST${rateKnown ? ` @ ${Number(data.taxRate)}%` : ""}`,
          formatCurrency(Number(data.taxAmount ?? 0)),
          false,
        ])
      }
    }
    rows.push(["Total Payable", formatCurrency(data.amount), true])
    rows.push(["Paid", formatCurrency(data.paidAmount), false])
    rows.push(["Balance Due", formatCurrency(data.outstandingAmount), true])

    for (const [label, value, emphasize] of rows) {
      doc
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .moveTo(50, y + 24)
        .lineTo(50 + pageWidth, y + 24)
        .stroke()
      doc
        .fillColor(emphasize ? BRAND : DARK)
        .fontSize(10)
        .font(emphasize ? "Helvetica-Bold" : "Helvetica")
        .text(label, 60, y + 7)
        .text(value, 50, y + 7, { width: pageWidth - 20, align: "right" })
      y += 24
    }

    y += 12

    // ── Remarks ─────────────────────────────────────────────────────────────
    if (data.remarks) {
      doc.fillColor(GRAY).fontSize(9).font("Helvetica").text("REMARKS", 50, y)
      y += 12
      doc
        .fillColor(DARK)
        .fontSize(9)
        .text(data.remarks, 50, y, { width: pageWidth })
      y += doc.heightOfString(data.remarks, { width: pageWidth }) + 12
    }

    y += 8

    // ── Payment history ─────────────────────────────────────────────────────
    if (data.payments.length > 0) {
      doc.fillColor(GRAY).fontSize(9).font("Helvetica").text("PAYMENTS RECEIVED", 50, y)
      y += 14
      for (const p of data.payments) {
        doc
          .fillColor(DARK)
          .fontSize(9)
          .font("Helvetica")
          .text(
            `${formatDate(p.paymentDate)} — ${formatCurrency(p.amount)}${p.method ? ` via ${p.method}` : ""}${p.reference ? ` (Ref: ${p.reference})` : ""}`,
            50,
            y
          )
        y += 14
      }
      y += 10
    }

    // ── How to pay ──────────────────────────────────────────────────────────
    const pd = data.paymentDetails
    const hasPaymentInfo =
      pd.bankAccountNumber || pd.upiId || pd.bankName || pd.bankAccountName
    if (data.outstandingAmount > 0 && hasPaymentInfo) {
      doc.fillColor(GRAY).fontSize(9).font("Helvetica").text("HOW TO PAY", 50, y)
      y += 14
      doc.fillColor(DARK).fontSize(9)
      if (pd.bankName) {
        doc.text(`Bank: ${pd.bankName}`, 50, y)
        y += 12
      }
      if (pd.bankAccountName) {
        doc.text(`Account Name: ${pd.bankAccountName}`, 50, y)
        y += 12
      }
      if (pd.bankAccountNumber) {
        doc.text(`Account No: ${pd.bankAccountNumber}`, 50, y)
        y += 12
      }
      if (pd.bankIfsc) {
        doc.text(`IFSC: ${pd.bankIfsc}`, 50, y)
        y += 12
      }
      if (pd.upiId) {
        doc.text(`UPI: ${pd.upiId}`, 50, y)
        y += 12
      }
      doc
        .fillColor(GRAY)
        .text(`Please quote invoice #${data.invoiceNumber} with your payment.`, 50, y + 4)
      y += 28
    }

    // ── Signature ───────────────────────────────────────────────────────────
    const signY = Math.min(Math.max(y + 30, doc.page.height - 170), doc.page.height - 170)
    doc
      .fillColor(DARK)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(`For ${data.firmName}`, 50 + pageWidth - 200, signY, {
        width: 200,
        align: "right",
      })
    doc
      .strokeColor(DARK)
      .lineWidth(0.75)
      .moveTo(50 + pageWidth - 170, signY + 48)
      .lineTo(50 + pageWidth, signY + 48)
      .stroke()
    doc
      .fillColor(GRAY)
      .fontSize(8)
      .font("Helvetica")
      .text("Authorised Signatory", 50 + pageWidth - 200, signY + 54, {
        width: 200,
        align: "right",
      })

    // ── Footer ──────────────────────────────────────────────────────────────
    doc
      .fillColor(GRAY)
      .fontSize(8)
      .font("Helvetica")
      .text(
        `Generated by ${data.firmName}. This is a computer-generated invoice.`,
        50,
        doc.page.height - 70,
        { width: pageWidth, align: "center" }
      )

    doc.end()
  })
}
