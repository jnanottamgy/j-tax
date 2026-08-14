import PDFDocument from "pdfkit"

import { drawLetterhead, textOneLine, type PdfLogo } from "@/lib/pdf/letterhead"

/**
 * The compliance status report — the thing a firm actually hands a client
 * across the table at a review meeting.
 *
 * The app could produce a PDF of an invoice and a quotation, which are the two
 * documents a client already receives by email. The document a partner needs in
 * a meeting is the one the app could not produce: what we file for you, what
 * has been filed, what is coming, and what is late. It was on screen and
 * nowhere else, so review meetings ran off a laptop turned sideways or a
 * screenshot pasted into Word.
 *
 * Deliberately plain. This is read across a table, printed, and sometimes
 * forwarded to the client's bank or investor, so it states dates and statuses
 * without commentary and without a marketing tone.
 */

const BRAND = "#1e3a8a"
const GRAY = "#6b7280"
const DARK = "#111827"
const BORDER = "#e5e7eb"
const RED = "#b91c1c"
const GREEN = "#15803d"

export type ComplianceReportRow = {
  title: string
  /** GST / TDS / ITR / ROC … as the firm labels it. */
  category: string
  dueDate: Date
  status: string
  /** When it was actually filed, where that is known. */
  filedOn?: Date | null
  /** Acknowledgement / ARN / challan number, when recorded. */
  reference?: string | null
}

export type ComplianceReportData = {
  firmName: string
  firmEmail: string
  firmPhone: string
  firmAddress: string
  firmLogo?: PdfLogo | null
  /** ICAI firm registration number, printed where the firm has recorded one. */
  icaiFrn?: string | null

  clientName: string
  clientCode: string
  clientGstin: string | null
  clientPan: string | null

  /** Period this report covers, already formatted for print. */
  periodLabel: string
  generatedOn: Date
  /** Who ran it — a report handed to a client should say who stands behind it. */
  preparedBy: string

  filed: ComplianceReportRow[]
  upcoming: ComplianceReportRow[]
  overdue: ComplianceReportRow[]
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const PAGE_BOTTOM = 780

export async function generateComplianceReportPDF(
  data: ComplianceReportData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    const chunks: Buffer[] = []

    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const pageWidth = doc.page.width - 100

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
      titleReserve: 170,
    })
    doc
      .fillColor("white")
      .fontSize(15)
      .font("Helvetica-Bold")
      .text("COMPLIANCE STATUS", 50, 78, { width: pageWidth - 20, align: "right" })

    let y = 155

    // ── Who this is about ───────────────────────────────────────────────────
    doc.fillColor(GRAY).fontSize(9).font("Helvetica")
    doc.text("Client", 50, y)
    doc.text("Period", 320, y)

    y += 13
    doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold")
    textOneLine(doc, data.clientName, 50, y, 250)
    doc.fontSize(10).text(data.periodLabel, 320, y)

    y += 16
    doc.fillColor(GRAY).fontSize(8.5).font("Helvetica")
    const idBits = [
      data.clientCode,
      data.clientGstin && `GSTIN ${data.clientGstin}`,
      data.clientPan && `PAN ${data.clientPan}`,
    ].filter(Boolean) as string[]
    textOneLine(doc, idBits.join("  ·  "), 50, y, 250)
    doc.text(`Prepared ${formatDate(data.generatedOn)} by ${data.preparedBy}`, 320, y, {
      width: pageWidth - 270,
    })

    y += 26
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor(BORDER).stroke()
    y += 18

    // ── Summary line ────────────────────────────────────────────────────────
    // The three numbers a client asks for before reading any table.
    doc.fillColor(DARK).fontSize(10).font("Helvetica")
    const summary = [
      `${data.filed.length} filed`,
      `${data.upcoming.length} upcoming`,
      `${data.overdue.length} overdue`,
    ].join("     ·     ")
    doc.text(summary, 50, y)
    if (data.overdue.length > 0) {
      doc
        .fillColor(RED)
        .fontSize(9)
        .text(
          "Overdue filings may attract interest and late fees. See the section below.",
          50,
          y + 15
        )
      y += 15
    }
    y += 26

    /** One table. Returns the y it finished at, breaking pages as needed. */
    function section(
      heading: string,
      rows: ComplianceReportRow[],
      accent: string,
      emptyNote: string
    ): void {
      if (y > PAGE_BOTTOM - 90) {
        doc.addPage()
        y = 50
      }

      doc.fillColor(accent).fontSize(11).font("Helvetica-Bold").text(heading, 50, y)
      y += 18

      if (rows.length === 0) {
        doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(emptyNote, 50, y)
        y += 26
        return
      }

      // Column heads
      doc.fillColor(GRAY).fontSize(8).font("Helvetica-Bold")
      doc.text("FILING", 50, y)
      doc.text("CATEGORY", 250, y)
      doc.text("DUE", 350, y)
      doc.text("STATUS", 430, y)
      y += 12
      doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor(BORDER).stroke()
      y += 8

      for (const row of rows) {
        if (y > PAGE_BOTTOM) {
          doc.addPage()
          y = 50
        }

        doc.fillColor(DARK).fontSize(9).font("Helvetica")
        textOneLine(doc, row.title, 50, y, 195)
        textOneLine(doc, row.category, 250, y, 95)
        doc.text(formatDate(row.dueDate), 350, y)

        const statusText = row.filedOn ? `Filed ${formatDate(row.filedOn)}` : row.status
        doc
          .fillColor(row.filedOn ? GREEN : accent)
          .text(statusText, 430, y, { width: pageWidth - 380 })

        y += 13
        if (row.reference) {
          doc.fillColor(GRAY).fontSize(8).font("Helvetica")
          textOneLine(doc, `Ref: ${row.reference}`, 50, y, 300)
          y += 11
        }
        y += 3
      }
      y += 16
    }

    section(
      "Overdue",
      data.overdue,
      RED,
      "Nothing overdue for this period."
    )
    section(
      "Upcoming",
      data.upcoming,
      BRAND,
      "No filings fall due in the remainder of this period."
    )
    section(
      "Filed",
      data.filed,
      GREEN,
      "No filings have been completed in this period yet."
    )

    // ── Footer ──────────────────────────────────────────────────────────────
    if (y > PAGE_BOTTOM - 60) {
      doc.addPage()
      y = 50
    }
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor(BORDER).stroke()
    y += 12
    doc.fillColor(GRAY).fontSize(7.5).font("Helvetica")
    doc.text(
      "This statement reflects the records held by the firm as at the date of preparation. It is not a certificate, and it does not confirm acceptance of any return by the relevant authority.",
      50,
      y,
      { width: pageWidth }
    )
    if (data.icaiFrn) {
      doc.text(`Firm Registration No. ${data.icaiFrn}`, 50, y + 22)
    }

    doc.end()
  })
}
