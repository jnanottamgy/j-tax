/**
 * GSTR-2B JSON parser — normalizes the GST portal's auto-drafted ITC
 * statement into flat document rows for reconciliation.
 *
 * Input: the JSON file downloaded from the portal (Returns → GSTR-2B →
 * Download JSON). Handles both the `{ data: {...} }` wrapper and a bare
 * payload, B2B invoices + credit/debit notes (cdnr), and amendment sections
 * (b2ba/cdnra, marked `amended: true`). Tolerant of missing sections —
 * anything unrecognised lands in `diagnostics`, never throws.
 */

export type Gstr2bDoc = {
  supplierGstin: string
  supplierName: string | null
  docType: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE"
  docNumber: string
  /** null when the portal date fails to parse */
  docDate: Date | null
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  totalTax: number
  /** Document value as filed (taxable + tax, per portal) */
  invoiceValue: number
  itcAvailable: boolean
  amended: boolean
}

export type Gstr2bParseResult = {
  gstin: string | null
  /** Return period as in the file, e.g. "062026" (MMYYYY) */
  period: string | null
  docs: Gstr2bDoc[]
  diagnostics: string[]
}

/** "15-06-2026" (portal format dd-mm-yyyy) → Date, else null */
function parsePortalDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null
  const m = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  return Number.isNaN(d.getTime()) ? null : d
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

type ItemTotals = { txval: number; igst: number; cgst: number; sgst: number; cess: number }

/** Sum item-level tax lines (`items: [{ rt, txval, igst, ... }]`). */
function sumItems(items: unknown): ItemTotals {
  const totals: ItemTotals = { txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
  if (!Array.isArray(items)) return totals
  for (const it of items) {
    if (typeof it !== "object" || it === null) continue
    const rec = it as Record<string, unknown>
    totals.txval += num(rec.txval)
    totals.igst += num(rec.igst)
    totals.cgst += num(rec.cgst)
    totals.sgst += num(rec.sgst)
    totals.cess += num(rec.cess)
  }
  return totals
}

const r2 = (n: number) => Math.round(n * 100) / 100

function buildDoc(opts: {
  supplierGstin: string
  supplierName: string | null
  docType: Gstr2bDoc["docType"]
  docNumber: string
  docDate: Date | null
  itemTotals: ItemTotals
  invoiceValue: number
  itcAvailable: boolean
  amended: boolean
}): Gstr2bDoc {
  const { itemTotals } = opts
  return {
    supplierGstin: opts.supplierGstin,
    supplierName: opts.supplierName,
    docType: opts.docType,
    docNumber: opts.docNumber,
    docDate: opts.docDate,
    taxableValue: r2(itemTotals.txval),
    igst: r2(itemTotals.igst),
    cgst: r2(itemTotals.cgst),
    sgst: r2(itemTotals.sgst),
    cess: r2(itemTotals.cess),
    totalTax: r2(itemTotals.igst + itemTotals.cgst + itemTotals.sgst + itemTotals.cess),
    invoiceValue: r2(opts.invoiceValue),
    itcAvailable: opts.itcAvailable,
    amended: opts.amended,
  }
}

/** Parse one b2b/b2ba supplier block (invoices under `inv`). */
function parseB2bBlock(block: Record<string, unknown>, amended: boolean, out: Gstr2bDoc[], diagnostics: string[]) {
  const ctin = typeof block.ctin === "string" ? block.ctin.toUpperCase() : null
  if (!ctin) {
    diagnostics.push("b2b block without supplier GSTIN (ctin) skipped")
    return
  }
  const name = typeof block.trdnm === "string" ? block.trdnm : null
  const invoices = Array.isArray(block.inv) ? block.inv : []
  for (const raw of invoices) {
    if (typeof raw !== "object" || raw === null) continue
    const inv = raw as Record<string, unknown>
    const inum = typeof inv.inum === "string" ? inv.inum.trim() : ""
    if (!inum) {
      diagnostics.push(`invoice without number from ${ctin} skipped`)
      continue
    }
    out.push(
      buildDoc({
        supplierGstin: ctin,
        supplierName: name,
        docType: "INVOICE",
        docNumber: inum,
        docDate: parsePortalDate(inv.dt),
        itemTotals: sumItems(inv.items),
        invoiceValue: num(inv.val),
        itcAvailable: inv.itcavl !== "N",
        amended,
      })
    )
  }
}

/** Parse one cdnr/cdnra supplier block (notes under `nt`). */
function parseCdnrBlock(block: Record<string, unknown>, amended: boolean, out: Gstr2bDoc[], diagnostics: string[]) {
  const ctin = typeof block.ctin === "string" ? block.ctin.toUpperCase() : null
  if (!ctin) {
    diagnostics.push("cdnr block without supplier GSTIN (ctin) skipped")
    return
  }
  const name = typeof block.trdnm === "string" ? block.trdnm : null
  const notes = Array.isArray(block.nt) ? block.nt : []
  for (const raw of notes) {
    if (typeof raw !== "object" || raw === null) continue
    const nt = raw as Record<string, unknown>
    const ntnum = typeof nt.ntnum === "string" ? nt.ntnum.trim() : ""
    if (!ntnum) {
      diagnostics.push(`note without number from ${ctin} skipped`)
      continue
    }
    const typ = typeof nt.typ === "string" ? nt.typ.toUpperCase() : "C"
    out.push(
      buildDoc({
        supplierGstin: ctin,
        supplierName: name,
        docType: typ === "D" ? "DEBIT_NOTE" : "CREDIT_NOTE",
        docNumber: ntnum,
        docDate: parsePortalDate(nt.dt),
        itemTotals: sumItems(nt.items),
        invoiceValue: num(nt.val),
        itcAvailable: nt.itcavl !== "N",
        amended,
      })
    )
  }
}

/**
 * Parse GSTR-2B JSON text. Never throws on structure problems — check
 * `diagnostics` (and an empty `docs`) to surface issues to the user.
 */
export function parseGstr2b(jsonText: string): Gstr2bParseResult {
  const diagnostics: string[] = []
  const docs: Gstr2bDoc[] = []

  let root: unknown
  try {
    root = JSON.parse(jsonText)
  } catch {
    return { gstin: null, period: null, docs, diagnostics: ["File is not valid JSON — download the JSON (not Excel) from the portal."] }
  }
  if (typeof root !== "object" || root === null) {
    return { gstin: null, period: null, docs, diagnostics: ["Unexpected JSON root — expected an object."] }
  }

  // Portal wraps the payload in { data: {...} }; accept a bare payload too.
  const wrapper = root as Record<string, unknown>
  const data = (typeof wrapper.data === "object" && wrapper.data !== null ? wrapper.data : root) as Record<string, unknown>

  const gstin = typeof data.gstin === "string" ? data.gstin.toUpperCase() : null
  const period = typeof data.rtnprd === "string" ? data.rtnprd : null

  const docdata = (typeof data.docdata === "object" && data.docdata !== null ? data.docdata : {}) as Record<string, unknown>
  if (Object.keys(docdata).length === 0) {
    diagnostics.push("No docdata section found — the statement may be empty for this period.")
  }

  for (const [section, amended, parser] of [
    ["b2b", false, parseB2bBlock],
    ["b2ba", true, parseB2bBlock],
    ["cdnr", false, parseCdnrBlock],
    ["cdnra", true, parseCdnrBlock],
  ] as const) {
    const blocks = docdata[section]
    if (!blocks) continue
    if (!Array.isArray(blocks)) {
      diagnostics.push(`Section ${section} has an unexpected shape and was skipped.`)
      continue
    }
    for (const b of blocks) {
      if (typeof b === "object" && b !== null) parser(b as Record<string, unknown>, amended, docs, diagnostics)
    }
  }

  return { gstin, period, docs, diagnostics }
}
