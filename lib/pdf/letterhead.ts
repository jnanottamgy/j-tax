/**
 * The header band shared by the invoice and quotation PDFs.
 *
 * Both documents opened with the firm name set as plain text on a navy band.
 * These are the two artefacts a client actually receives, so they carry the
 * firm's letterhead when one is configured — logo on the left, firm name and
 * contact details beside it, and the document title (INVOICE / QUOTATION)
 * still right-aligned by the caller.
 *
 * Geometry without a logo is byte-for-byte what it was, so documents from
 * firms that never upload one are unchanged.
 */

export type PdfLogo = {
  /** Raw PNG or JPEG bytes — pdfkit embeds these two formats only. */
  data: Buffer
  mimeType: string
}

/** Side of the white plate the logo sits on, inside the band. */
const PLATE = 56
const PLATE_INSET = 12
/** Gap between the plate and the firm name. */
const PLATE_GAP = 12

type LetterheadOptions = {
  x: number
  y: number
  width: number
  height: number
  logo?: PdfLogo | null
  firmName: string
  /** Contact lines under the name; blanks are dropped. */
  lines: Array<string | null | undefined>
  /** Reserved on the right for the caller's document title. */
  titleReserve: number
  bandColor: string
}

/** pdfkit ships no usable public type for a document instance in this setup. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any

/**
 * One line, truncated with an ellipsis if it will not fit.
 *
 * Hand-rolled rather than using pdfkit's `ellipsis` option, which only applies
 * inside a width+height box and then appends the mark to *every* last line —
 * including text that fits perfectly well. Passing `lineBreak: false` with no
 * width skips pdfkit's wrapper entirely, so this is the only thing deciding
 * where the line ends.
 *
 * Long firm names are the norm here ("… & Associates Chartered Accountants
 * LLP"). Unconstrained they wrapped to three 22pt lines that ran straight out
 * of the header band and over the invoice meta block below it.
 */
function textOneLine(doc: Doc, text: string, x: number, y: number, maxWidth: number): void {
  if (doc.widthOfString(text) <= maxWidth) {
    doc.text(text, x, y, { lineBreak: false })
    return
  }
  let s = text
  while (s.length > 1 && doc.widthOfString(`${s}…`) > maxWidth) {
    s = s.slice(0, -1)
  }
  doc.text(`${s.trimEnd()}…`, x, y, { lineBreak: false })
}

export function drawLetterhead(doc: Doc, opts: LetterheadOptions): void {
  const { x, y, width, height, firmName, lines, titleReserve, bandColor } = opts

  doc.rect(x, y, width, height).fill(bandColor)

  // A logo is usually dark artwork on a transparent background; dropped
  // straight onto navy it disappears. The white plate is also what a printed
  // letterhead looks like, so it is the honest rendering rather than a hack.
  let textX = x + 20
  const logo = opts.logo
  if (logo?.data?.length) {
    const plateX = x + PLATE_INSET
    const plateY = y + (height - PLATE) / 2
    try {
      doc.save()
      doc.roundedRect(plateX, plateY, PLATE, PLATE, 6).fill("#ffffff")
      doc.image(logo.data, plateX + 4, plateY + 4, {
        fit: [PLATE - 8, PLATE - 8],
        align: "center",
        valign: "center",
      })
      doc.restore()
      textX = plateX + PLATE + PLATE_GAP
    } catch (err) {
      // A corrupt or unsupported image must never cost the firm its invoice.
      // Repaint the band over the half-drawn plate and fall back to wordmark.
      console.error("Letterhead logo could not be embedded:", err)
      doc.restore()
      doc.rect(x, y, width, height).fill(bandColor)
      textX = x + 20
    }
  }

  // Everything to the left of the space the caller reserved for its title.
  const textWidth = Math.max(80, x + width - titleReserve - textX)

  doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
  textOneLine(doc, firmName, textX, y + 15, textWidth)

  doc.fontSize(9).font("Helvetica")
  const detail = lines.map((l) => (l ?? "").trim()).filter(Boolean)
  detail.slice(0, 2).forEach((line, i) => {
    textOneLine(doc, line, textX, y + 42 + i * 14, textWidth)
  })
}
