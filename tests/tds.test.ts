/**
 * TDS on the firm's own fees.
 *
 * This is not only a missing feature — it was wrong arithmetic. A ₹1,00,000
 * invoice settled by a ₹90,000 transfer with ₹10,000 withheld was recorded as
 * a ₹90,000 payment, so the invoice stayed PARTIALLY_PAID with ₹10,000
 * outstanding for ever, and the firm chased money already paid to the
 * government on its behalf.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { applySettlement, suggestedTds, tdsQuarter } from "@/lib/billing/tds"

describe("applySettlement", () => {
  test("cash plus TDS closes the invoice", () => {
    // The case the whole thing exists for.
    const s = applySettlement({
      invoiceTotal: 100000,
      alreadySettled: 0,
      received: 90000,
      tdsDeducted: 10000,
    })
    assert.equal(s.ok, true)
    if (s.ok) {
      assert.equal(s.outstanding, 0)
      assert.equal(s.fullySettled, true)
      assert.equal(s.paidToDate, 100000)
    }
  })

  test("cash alone leaves the deducted amount outstanding — the old behaviour", () => {
    // Kept as an explicit counter-example: this is what the app used to do to
    // every invoice a company client paid.
    const s = applySettlement({
      invoiceTotal: 100000,
      alreadySettled: 0,
      received: 90000,
      tdsDeducted: 0,
    })
    assert.equal(s.ok, true)
    if (s.ok) {
      assert.equal(s.outstanding, 10000)
      assert.equal(s.fullySettled, false)
    }
  })

  test("an invoice settled entirely by TDS is still settled", () => {
    // Rare but real, and refusing a zero cash amount would leave it open for
    // ever with no way to close it honestly.
    const s = applySettlement({
      invoiceTotal: 10000,
      alreadySettled: 0,
      received: 0,
      tdsDeducted: 10000,
    })
    assert.equal(s.ok, true)
    if (s.ok) assert.equal(s.fullySettled, true)
  })

  test("nothing at all is refused", () => {
    const s = applySettlement({
      invoiceTotal: 10000,
      alreadySettled: 0,
      received: 0,
      tdsDeducted: 0,
    })
    assert.equal(s.ok, false)
  })

  test("over-settlement is refused and says by how much", () => {
    const s = applySettlement({
      invoiceTotal: 100000,
      alreadySettled: 50000,
      received: 60000,
      tdsDeducted: 0,
    })
    assert.equal(s.ok, false)
    if (!s.ok) assert.match(s.error, /50,000/)
  })

  test("a payment that exactly clears the balance is not rejected as an overpayment", () => {
    // Floating point makes 33333.33 * 3 exceed 100000 by a hundredth of a
    // rupee, which would refuse the payment most likely to be correct.
    const s = applySettlement({
      invoiceTotal: 100000,
      alreadySettled: 66666.67,
      received: 33333.33,
      tdsDeducted: 0,
    })
    assert.equal(s.ok, true)
    if (s.ok) assert.equal(s.outstanding, 0)
  })

  test("negative amounts are refused", () => {
    const s = applySettlement({
      invoiceTotal: 10000,
      alreadySettled: 0,
      received: -100,
      tdsDeducted: 200,
    })
    assert.equal(s.ok, false)
  })

  test("partial settlement leaves the right balance", () => {
    const s = applySettlement({
      invoiceTotal: 118000,
      alreadySettled: 0,
      received: 53100,
      tdsDeducted: 5900,
    })
    assert.equal(s.ok, true)
    if (s.ok) {
      assert.equal(s.paidToDate, 59000)
      assert.equal(s.outstanding, 59000)
    }
  })
})

describe("suggestedTds", () => {
  test("194J is 10% of the professional fee", () => {
    assert.equal(suggestedTds("194J", 100000), 10000)
  })

  test("194C is 2%", () => {
    assert.equal(suggestedTds("194C", 100000), 2000)
  })

  test("a section with no standard rate suggests nothing rather than guessing", () => {
    assert.equal(suggestedTds("OTHER", 100000), null)
  })

  test("no fee, no suggestion", () => {
    assert.equal(suggestedTds("194J", 0), null)
  })
})

describe("tdsQuarter", () => {
  test("April starts Q1 of the new financial year", () => {
    const q = tdsQuarter(new Date(2026, 3, 5))
    assert.equal(q.quarter, 1)
    assert.equal(q.financialYear, "2026-27")
  })

  test("March is Q4 of the year that began the previous April", () => {
    // The case a calendar quarter gets wrong: March 2027 belongs to FY 2026-27
    // Q4, not to Q1 of 2027.
    const q = tdsQuarter(new Date(2027, 2, 20))
    assert.equal(q.quarter, 4)
    assert.equal(q.financialYear, "2026-27")
  })

  test("January is Q4, not Q1", () => {
    const q = tdsQuarter(new Date(2027, 0, 10))
    assert.equal(q.quarter, 4)
    assert.equal(q.label, "Q4 2026-27")
  })

  test("September closes Q2", () => {
    assert.equal(tdsQuarter(new Date(2026, 8, 30)).quarter, 2)
  })
})
