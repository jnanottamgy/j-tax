/**
 * GSTR-2B ↔ purchase register reconciliation engine.
 *
 * Pure functions, no I/O. Matching runs in three tiers per supplier GSTIN:
 *   1. EXACT — trimmed, uppercased document number
 *   2. LOOSE — alphanumeric-only number with numeric runs de-zero-padded
 *              ("INV/007" ≡ "inv-7"), the most common books-vs-portal drift
 *   3. FUZZY — same supplier, taxable value within tolerance, dates within
 *              5 days (when both sides carry a date)
 * Matched pairs are then judged on amounts: within ₹1 → MATCHED, else
 * MISMATCH with signed deltas. Leftovers become MISSING_IN_BOOKS (portal-only:
 * unclaimed ITC) or MISSING_IN_2B (books-only: supplier hasn't filed — ITC at
 * risk).
 */

import type { Gstr2bDoc } from "./gstr2b"

export type RegisterDoc = {
  supplierGstin: string
  supplierName?: string | null
  docType?: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE"
  docNumber: string
  docDate: Date | null
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  totalTax: number
}

export type ReconSide = {
  docNumber: string
  docDate: Date | null
  docType: string
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
  totalTax: number
}

export type ReconBucket =
  | "MATCHED"
  | "MISMATCH"
  | "MISSING_IN_BOOKS"
  | "MISSING_IN_2B"

export type ReconEntry = {
  bucket: ReconBucket
  supplierGstin: string
  supplierName: string | null
  /** EXACT | LOOSE | FUZZY — present on matched/mismatched pairs */
  matchTier?: "EXACT" | "LOOSE" | "FUZZY"
  books?: ReconSide
  portal?: ReconSide
  /** portal − books; present on matched/mismatched pairs */
  deltas?: { taxableValue: number; totalTax: number }
}

export type VendorSummary = {
  supplierGstin: string
  supplierName: string | null
  booksTax: number
  portalTax: number
  /** portal − books */
  diff: number
  docs: number
}

export type ReconSummary = {
  counts: Record<ReconBucket, number>
  /** Total tax (ITC) sitting in 2B but absent from the register */
  unclaimedItc: number
  /** Total tax booked but missing from 2B — at risk of reversal */
  itcAtRisk: number
  /** Net tax delta across mismatched pairs (portal − books) */
  mismatchTaxDelta: number
  vendors: VendorSummary[]
}

export type ReconResult = { entries: ReconEntry[]; summary: ReconSummary }

const r2 = (n: number) => Math.round(n * 100) / 100

const strictNum = (n: string) => n.trim().toUpperCase()

/** "INV/007-A" → "INV7A": alphanumeric-only, numeric runs de-zero-padded. */
export function looseDocNumber(n: string): string {
  return n
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/\d+/g, (run) => String(Number(run)))
}

function toSide(d: Gstr2bDoc | RegisterDoc): ReconSide {
  return {
    docNumber: d.docNumber,
    docDate: d.docDate,
    docType: ("docType" in d && d.docType) || "INVOICE",
    taxableValue: r2(d.taxableValue),
    igst: r2(d.igst),
    cgst: r2(d.cgst),
    sgst: r2(d.sgst),
    cess: r2(d.cess),
    totalTax: r2(d.totalTax),
  }
}

function judgePair(
  books: RegisterDoc,
  portal: Gstr2bDoc,
  tier: "EXACT" | "LOOSE" | "FUZZY"
): ReconEntry {
  const taxableDelta = r2(portal.taxableValue - books.taxableValue)
  const taxDelta = r2(portal.totalTax - books.totalTax)
  const matched = Math.abs(taxableDelta) <= 1 && Math.abs(taxDelta) <= 1
  return {
    bucket: matched ? "MATCHED" : "MISMATCH",
    supplierGstin: portal.supplierGstin,
    supplierName: portal.supplierName ?? books.supplierName ?? null,
    matchTier: tier,
    books: toSide(books),
    portal: toSide(portal),
    deltas: { taxableValue: taxableDelta, totalTax: taxDelta },
  }
}

const dayDiff = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 86_400_000

export function reconcile(booksDocs: RegisterDoc[], portalDocs: Gstr2bDoc[]): ReconResult {
  const entries: ReconEntry[] = []
  const usedBooks = new Set<number>()
  const usedPortal = new Set<number>()

  // Index the portal side by GSTIN + number for the two key tiers
  const byKey = (keyFn: (n: string) => string) => {
    const map = new Map<string, number[]>()
    portalDocs.forEach((d, i) => {
      const key = `${d.supplierGstin}|${keyFn(d.docNumber)}`
      const list = map.get(key)
      if (list) list.push(i)
      else map.set(key, [i])
    })
    return map
  }

  for (const [tier, keyFn] of [
    ["EXACT", strictNum],
    ["LOOSE", looseDocNumber],
  ] as const) {
    const index = byKey(keyFn)
    booksDocs.forEach((b, bi) => {
      if (usedBooks.has(bi)) return
      const key = `${b.supplierGstin.toUpperCase()}|${keyFn(b.docNumber)}`
      const candidates = index.get(key)
      if (!candidates) return
      const pi = candidates.find((i) => !usedPortal.has(i))
      if (pi === undefined) return
      usedBooks.add(bi)
      usedPortal.add(pi)
      entries.push(judgePair(b, portalDocs[pi], tier))
    })
  }

  // FUZZY — same supplier, value within max(₹1, 0.5%), dates within 5 days
  const portalByGstin = new Map<string, number[]>()
  portalDocs.forEach((d, i) => {
    if (usedPortal.has(i)) return
    const list = portalByGstin.get(d.supplierGstin)
    if (list) list.push(i)
    else portalByGstin.set(d.supplierGstin, [i])
  })
  booksDocs.forEach((b, bi) => {
    if (usedBooks.has(bi)) return
    const candidates = portalByGstin.get(b.supplierGstin.toUpperCase()) ?? []
    for (const pi of candidates) {
      if (usedPortal.has(pi)) continue
      const p = portalDocs[pi]
      const tolerance = Math.max(1, 0.005 * Math.max(Math.abs(b.taxableValue), Math.abs(p.taxableValue)))
      if (Math.abs(p.taxableValue - b.taxableValue) > tolerance) continue
      if (b.docDate && p.docDate && dayDiff(b.docDate, p.docDate) > 5) continue
      usedBooks.add(bi)
      usedPortal.add(pi)
      entries.push(judgePair(b, p, "FUZZY"))
      break
    }
  })

  // Leftovers
  booksDocs.forEach((b, bi) => {
    if (usedBooks.has(bi)) return
    entries.push({
      bucket: "MISSING_IN_2B",
      supplierGstin: b.supplierGstin.toUpperCase(),
      supplierName: b.supplierName ?? null,
      books: toSide(b),
    })
  })
  portalDocs.forEach((p, pi) => {
    if (usedPortal.has(pi)) return
    entries.push({
      bucket: "MISSING_IN_BOOKS",
      supplierGstin: p.supplierGstin,
      supplierName: p.supplierName,
      portal: toSide(p),
    })
  })

  // ── Summary ────────────────────────────────────────────────────────────────
  const counts: Record<ReconBucket, number> = {
    MATCHED: 0,
    MISMATCH: 0,
    MISSING_IN_BOOKS: 0,
    MISSING_IN_2B: 0,
  }
  let unclaimedItc = 0
  let itcAtRisk = 0
  let mismatchTaxDelta = 0
  const vendorMap = new Map<string, VendorSummary>()

  for (const e of entries) {
    counts[e.bucket]++
    if (e.bucket === "MISSING_IN_BOOKS") unclaimedItc += e.portal?.totalTax ?? 0
    if (e.bucket === "MISSING_IN_2B") itcAtRisk += e.books?.totalTax ?? 0
    if (e.bucket === "MISMATCH") mismatchTaxDelta += e.deltas?.totalTax ?? 0

    let v = vendorMap.get(e.supplierGstin)
    if (!v) {
      v = { supplierGstin: e.supplierGstin, supplierName: e.supplierName, booksTax: 0, portalTax: 0, diff: 0, docs: 0 }
      vendorMap.set(e.supplierGstin, v)
    }
    if (!v.supplierName && e.supplierName) v.supplierName = e.supplierName
    v.docs++
    v.booksTax = r2(v.booksTax + (e.books?.totalTax ?? 0))
    v.portalTax = r2(v.portalTax + (e.portal?.totalTax ?? 0))
    v.diff = r2(v.portalTax - v.booksTax)
  }

  const vendors = [...vendorMap.values()].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  return {
    entries,
    summary: {
      counts,
      unclaimedItc: r2(unclaimedItc),
      itcAtRisk: r2(itcAtRisk),
      mismatchTaxDelta: r2(mismatchTaxDelta),
      vendors,
    },
  }
}
