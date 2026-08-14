/**
 * Fee realisation — quoted, invoiced, collected.
 *
 * Three numbers the firm already had and could never see side by side, so the
 * two questions that decide whether a practice makes money had no answer: are
 * we billing what we agreed, and collecting what we billed.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { computeRealisation, totalRealisation } from "@/lib/billing/realisation"

const row = (over: Partial<Parameters<typeof computeRealisation>[0]> = {}) =>
  computeRealisation({
    key: "c1",
    label: "Acme",
    quoted: 100000,
    invoiced: 80000,
    collected: 60000,
    writtenOff: 0,
    ...over,
  })

describe("computeRealisation", () => {
  test("the three rates measure three different failures", () => {
    const r = row()
    assert.equal(r.billingRate, 80) // agreed 1L, billed 80k
    assert.equal(r.collectionRate, 75) // billed 80k, collected 60k
    assert.equal(r.realisationRate, 60) // agreed 1L, collected 60k
  })

  test("leakage is what was agreed and never billed", () => {
    assert.equal(row().leakage, 20000)
  })

  test("billing above the agreed fee is not negative leakage", () => {
    // Extra scope and revised engagements are normal. Reporting a negative
    // would invite somebody to "correct" a perfectly good over-recovery.
    const r = row({ invoiced: 120000 })
    assert.equal(r.leakage, 0)
    assert.equal(r.billingRate, 120)
  })

  test("a write-off leaves the invoice out of outstanding", () => {
    // Written off is money given up, not money owed. Leaving it in outstanding
    // is how a receivables report stays permanently wrong.
    const r = row({ invoiced: 80000, collected: 60000, writtenOff: 20000 })
    assert.equal(r.outstanding, 0)
  })

  test("no agreed fee means no billing or realisation rate, rather than zero", () => {
    // Zero would read as "we billed nothing of what we agreed", which is a
    // different and much worse statement than "nothing was agreed".
    const r = row({ quoted: null })
    assert.equal(r.billingRate, null)
    assert.equal(r.realisationRate, null)
    assert.equal(r.leakage, null)
    assert.equal(r.collectionRate, 75)
  })

  test("nothing invoiced means no collection rate", () => {
    const r = row({ invoiced: 0, collected: 0 })
    assert.equal(r.collectionRate, null)
  })
})

describe("totalRealisation", () => {
  test("rates come from the summed amounts, not an average of percentages", () => {
    // A ₹5,000 client collecting 100% must not offset a ₹5,00,000 client
    // collecting 20%. Averaging the rates gives 60%; the truth is 20.8%.
    const rows = [
      row({ key: "big", quoted: 500000, invoiced: 500000, collected: 100000 }),
      row({ key: "small", quoted: 5000, invoiced: 5000, collected: 5000 }),
    ]
    const t = totalRealisation(rows)
    assert.equal(t.collectionRate, 20.8)
    assert.notEqual(t.collectionRate, 60)
  })

  test("unpriced work does not dilute the billing rate", () => {
    // A row with no agreed fee has nothing to be measured against, so its
    // invoiced amount must not count towards "billed vs agreed" either.
    const rows = [
      row({ key: "priced", quoted: 100000, invoiced: 50000, collected: 50000 }),
      row({ key: "unpriced", quoted: null, invoiced: 900000, collected: 900000 }),
    ]
    const t = totalRealisation(rows)
    assert.equal(t.billingRate, 50)
  })

  test("leaking rows are counted and summed", () => {
    const rows = [
      row({ key: "a", quoted: 100000, invoiced: 80000 }),
      row({ key: "b", quoted: 50000, invoiced: 50000 }),
      row({ key: "c", quoted: 40000, invoiced: 30000 }),
    ]
    const t = totalRealisation(rows)
    assert.equal(t.leakingCount, 2)
    assert.equal(t.totalLeakage, 30000)
  })

  test("an empty firm reports no rates rather than zero", () => {
    const t = totalRealisation([])
    assert.equal(t.collectionRate, null)
    assert.equal(t.realisationRate, null)
    assert.equal(t.quoted, 0)
  })
})
