/**
 * Unit tests for the GSTR-2B parser and the reconciliation engine.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { parseGstr2b } from "@/lib/gst/gstr2b"
import { reconcile, looseDocNumber, type RegisterDoc } from "@/lib/gst/reconcile"

// ─── Fixture: a realistic portal download ────────────────────────────────────

const PORTAL_JSON = JSON.stringify({
  data: {
    gstin: "27AAPFU0939F1ZV",
    rtnprd: "062026",
    docdata: {
      b2b: [
        {
          ctin: "29AABCU9603R1ZL",
          trdnm: "Steel Suppliers Pvt Ltd",
          inv: [
            {
              inum: "INV/007",
              dt: "15-06-2026",
              val: 118000,
              itcavl: "Y",
              items: [{ num: 1, rt: 18, txval: 100000, igst: 18000, cgst: 0, sgst: 0, cess: 0 }],
            },
            {
              inum: "SS-042",
              dt: "20-06-2026",
              val: 59000,
              itcavl: "Y",
              items: [{ num: 1, rt: 18, txval: 50000, igst: 9000, cgst: 0, sgst: 0, cess: 0 }],
            },
          ],
        },
        {
          ctin: "27AAACI1681G1ZX",
          trdnm: "Mumbai Traders",
          inv: [
            {
              inum: "MT-100",
              dt: "10-06-2026",
              val: 23600,
              itcavl: "Y",
              items: [
                { num: 1, rt: 18, txval: 10000, igst: 0, cgst: 900, sgst: 900, cess: 0 },
                { num: 2, rt: 18, txval: 10000, igst: 0, cgst: 900, sgst: 900, cess: 0 },
              ],
            },
          ],
        },
      ],
      cdnr: [
        {
          ctin: "29AABCU9603R1ZL",
          trdnm: "Steel Suppliers Pvt Ltd",
          nt: [
            {
              ntnum: "CN-01",
              typ: "C",
              dt: "25-06-2026",
              val: 11800,
              itcavl: "Y",
              items: [{ num: 1, rt: 18, txval: 10000, igst: 1800, cgst: 0, sgst: 0, cess: 0 }],
            },
          ],
        },
      ],
    },
  },
})

const registerDoc = (over: Partial<RegisterDoc>): RegisterDoc => ({
  supplierGstin: "29AABCU9603R1ZL",
  supplierName: "Steel Suppliers",
  docNumber: "X",
  docDate: new Date(2026, 5, 15),
  taxableValue: 0,
  igst: 0,
  cgst: 0,
  sgst: 0,
  cess: 0,
  totalTax: 0,
  ...over,
})

describe("parseGstr2b", () => {
  test("parses b2b invoices with item-level tax rollup", () => {
    const r = parseGstr2b(PORTAL_JSON)
    assert.equal(r.gstin, "27AAPFU0939F1ZV")
    assert.equal(r.period, "062026")
    assert.equal(r.docs.length, 4) // 3 invoices + 1 credit note

    const mt = r.docs.find((d) => d.docNumber === "MT-100")!
    assert.equal(mt.taxableValue, 20000) // two item lines summed
    assert.equal(mt.cgst, 1800)
    assert.equal(mt.sgst, 1800)
    assert.equal(mt.totalTax, 3600)
    assert.equal(mt.docDate?.getDate(), 10)
  })

  test("credit notes carry their type", () => {
    const r = parseGstr2b(PORTAL_JSON)
    const cn = r.docs.find((d) => d.docNumber === "CN-01")!
    assert.equal(cn.docType, "CREDIT_NOTE")
    assert.equal(cn.totalTax, 1800)
  })

  test("invalid JSON and empty payloads degrade to diagnostics", () => {
    assert.ok(parseGstr2b("not json").diagnostics[0].includes("not valid JSON"))
    const empty = parseGstr2b(JSON.stringify({ data: { gstin: "X" } }))
    assert.equal(empty.docs.length, 0)
    assert.ok(empty.diagnostics.length > 0)
  })
})

describe("looseDocNumber", () => {
  test("normalizes separators and zero-padding", () => {
    assert.equal(looseDocNumber("INV/007"), looseDocNumber("inv-7"))
    assert.equal(looseDocNumber("SS 042"), looseDocNumber("SS42"))
    assert.notEqual(looseDocNumber("INV-7"), looseDocNumber("INV-8"))
  })
})

describe("reconcile", () => {
  const portal = parseGstr2b(PORTAL_JSON).docs

  test("exact + loose + fuzzy tiers all land", () => {
    const books: RegisterDoc[] = [
      // EXACT: same number
      registerDoc({ docNumber: "SS-042", taxableValue: 50000, igst: 9000, totalTax: 9000, docDate: new Date(2026, 5, 20) }),
      // LOOSE: books wrote "INV-7" for portal "INV/007"
      registerDoc({ docNumber: "INV-7", taxableValue: 100000, igst: 18000, totalTax: 18000 }),
      // FUZZY: number totally different, but same supplier + value + close date
      registerDoc({
        supplierGstin: "27AAACI1681G1ZX",
        docNumber: "PURCHASE-88",
        taxableValue: 20000,
        cgst: 1800,
        sgst: 1800,
        totalTax: 3600,
        docDate: new Date(2026, 5, 12),
      }),
    ]
    const { entries, summary } = reconcile(books, portal)
    const tiers = entries.filter((e) => e.matchTier).map((e) => e.matchTier).sort()
    assert.deepEqual(tiers, ["EXACT", "FUZZY", "LOOSE"])
    assert.equal(summary.counts.MATCHED, 3)
    // the credit note remains portal-only
    assert.equal(summary.counts.MISSING_IN_BOOKS, 1)
    assert.equal(summary.unclaimedItc, 1800)
  })

  test("value differences become MISMATCH with signed deltas", () => {
    const books: RegisterDoc[] = [
      registerDoc({ docNumber: "SS-042", taxableValue: 50000, igst: 8500, totalTax: 8500, docDate: new Date(2026, 5, 20) }),
    ]
    const { entries, summary } = reconcile(books, portal)
    const mm = entries.find((e) => e.bucket === "MISMATCH")!
    assert.equal(mm.deltas?.totalTax, 500) // portal 9000 − books 8500
    assert.equal(summary.mismatchTaxDelta, 500)
  })

  test("books-only docs are MISSING_IN_2B (ITC at risk)", () => {
    const books: RegisterDoc[] = [
      registerDoc({
        supplierGstin: "33AAACI1681G1Z9",
        docNumber: "UNFILED-1",
        taxableValue: 75000,
        igst: 13500,
        totalTax: 13500,
      }),
    ]
    const { summary } = reconcile(books, portal)
    assert.equal(summary.counts.MISSING_IN_2B, 1)
    assert.equal(summary.itcAtRisk, 13500)
    assert.equal(summary.counts.MISSING_IN_BOOKS, 4) // all portal docs unmatched
  })

  test("₹1 tolerance keeps rounding noise out of MISMATCH", () => {
    const books: RegisterDoc[] = [
      registerDoc({ docNumber: "SS-042", taxableValue: 50000.4, igst: 8999.6, totalTax: 8999.6, docDate: new Date(2026, 5, 20) }),
    ]
    const { entries } = reconcile(books, portal)
    assert.equal(entries.find((e) => e.books?.docNumber === "SS-042")?.bucket, "MATCHED")
  })

  test("vendor summary ranks by absolute diff", () => {
    const books: RegisterDoc[] = [
      registerDoc({ docNumber: "SS-042", taxableValue: 50000, igst: 9000, totalTax: 9000, docDate: new Date(2026, 5, 20) }),
    ]
    const { summary } = reconcile(books, portal)
    assert.ok(summary.vendors.length >= 2)
    // Steel Suppliers: portal has INV/007 (18000) + CN-01 (1800) + SS-042 (9000) vs books 9000 → diff 19800
    const steel = summary.vendors.find((v) => v.supplierGstin === "29AABCU9603R1ZL")!
    assert.equal(steel.diff, 19800)
    // sorted by |diff| descending
    const diffs = summary.vendors.map((v) => Math.abs(v.diff))
    assert.deepEqual(diffs, [...diffs].sort((a, b) => b - a))
  })

  test("duplicate numbers pair one-to-one, never double-match", () => {
    const books: RegisterDoc[] = [
      registerDoc({ docNumber: "INV/007", taxableValue: 100000, igst: 18000, totalTax: 18000 }),
      registerDoc({ docNumber: "INV/007", taxableValue: 100000, igst: 18000, totalTax: 18000 }),
    ]
    const { summary } = reconcile(books, portal)
    // one pairs (EXACT), the duplicate becomes MISSING_IN_2B... unless fuzzy
    // grabs another same-supplier doc — SS-042 has a different value, so no.
    assert.equal(summary.counts.MISSING_IN_2B, 1)
  })
})
