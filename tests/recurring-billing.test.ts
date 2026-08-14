/**
 * Retainer billing — the invoice a monthly engagement raises on its own.
 *
 * The arithmetic here is the part that quietly loses money if it is wrong: a
 * cycle that skips a month bills eleven times a year, and one that collapses a
 * catch-up bills once for three months of work.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  addMonthsClamped,
  billingPeriodLabel,
  catchUpPeriods,
  decideBilling,
  nextBillingDate,
  type BillableEngagement,
} from "@/lib/billing/recurring"

const base: BillableEngagement = {
  id: "svc_1",
  clientId: "cl_1",
  serviceType: "GST_RETURN",
  agreedFee: 5000,
  frequency: "MONTHLY",
  autoInvoice: true,
  nextBillingDate: new Date(2026, 7, 1),
  isActive: true,
  clientIsActive: true,
}

describe("addMonthsClamped", () => {
  test("31 January plus one month is 28 February, not 3 March", () => {
    // Plain setMonth overflows into the next month, which would move a retainer
    // billed on the 31st off its own anniversary permanently.
    const r = addMonthsClamped(new Date(2026, 0, 31), 1)
    assert.equal(r.getMonth(), 1)
    assert.equal(r.getDate(), 28)
  })

  test("a leap February gets the 29th", () => {
    const r = addMonthsClamped(new Date(2028, 0, 31), 1)
    assert.equal(r.getDate(), 29)
  })

  test("the day of month is restored after a short month", () => {
    // 31 Jan → 28 Feb → 31 Mar. Clamping must not be sticky, or every retainer
    // would drift down to the 28th and stay there.
    const feb = addMonthsClamped(new Date(2026, 0, 31), 1)
    const mar = addMonthsClamped(new Date(2026, 0, 31), 2)
    assert.equal(feb.getDate(), 28)
    assert.equal(mar.getDate(), 31)
  })

  test("crosses a year boundary", () => {
    const r = addMonthsClamped(new Date(2026, 11, 15), 1)
    assert.equal(r.getFullYear(), 2027)
    assert.equal(r.getMonth(), 0)
  })
})

describe("nextBillingDate", () => {
  test("quarterly moves three months", () => {
    const r = nextBillingDate("QUARTERLY", new Date(2026, 3, 10))
    assert.equal(r?.getMonth(), 6)
  })

  test("one-off never recurs", () => {
    assert.equal(nextBillingDate("ONE_TIME", new Date()), null)
  })
})

describe("billingPeriodLabel", () => {
  test("monthly names the month", () => {
    assert.equal(billingPeriodLabel("MONTHLY", new Date(2026, 7, 1)), "Aug 2026")
  })

  test("quarterly names the span", () => {
    assert.equal(billingPeriodLabel("QUARTERLY", new Date(2026, 6, 1)), "Jul–Sep 2026")
  })

  test("a quarter crossing new year names both years", () => {
    assert.equal(
      billingPeriodLabel("QUARTERLY", new Date(2026, 11, 1)),
      "Dec 2026 – Feb 2027"
    )
  })
})

describe("decideBilling", () => {
  test("bills when due", () => {
    const d = decideBilling(base, new Date(2026, 7, 1))
    assert.equal(d.bill, true)
    if (d.bill) {
      assert.equal(d.amount, 5000)
      assert.equal(d.periodLabel, "Aug 2026")
      assert.equal(d.nextAfter.getMonth(), 8)
    }
  })

  test("does not bill before the due date", () => {
    const d = decideBilling(base, new Date(2026, 6, 31))
    assert.deepEqual(d, { bill: false, reason: "not-due" })
  })

  test("an engagement with no agreed fee is skipped, not guessed at", () => {
    // Inventing an amount would be worse than not billing, and the skip is
    // counted and reported so it does not read as "nothing was due".
    const d = decideBilling({ ...base, agreedFee: null }, new Date(2026, 7, 1))
    assert.deepEqual(d, { bill: false, reason: "no-fee" })
  })

  test("a zero fee is not a fee", () => {
    const d = decideBilling({ ...base, agreedFee: 0 }, new Date(2026, 7, 1))
    assert.deepEqual(d, { bill: false, reason: "no-fee" })
  })

  test("an inactive client stops billing", () => {
    // A paused engagement that kept invoicing is the failure that costs a firm
    // its client relationship, not just money.
    const d = decideBilling({ ...base, clientIsActive: false }, new Date(2026, 7, 1))
    assert.deepEqual(d, { bill: false, reason: "client-inactive" })
  })

  test("an inactive service stops billing", () => {
    const d = decideBilling({ ...base, isActive: false }, new Date(2026, 7, 1))
    assert.deepEqual(d, { bill: false, reason: "inactive" })
  })

  test("one-off work never bills automatically", () => {
    const d = decideBilling({ ...base, frequency: "ONE_TIME" }, new Date(2026, 7, 1))
    assert.deepEqual(d, { bill: false, reason: "not-recurring" })
  })

  test("switched off means switched off", () => {
    const d = decideBilling({ ...base, autoInvoice: false }, new Date(2026, 7, 1))
    assert.deepEqual(d, { bill: false, reason: "not-enabled" })
  })

  test("no schedule is its own reason, distinct from not-due", () => {
    const d = decideBilling({ ...base, nextBillingDate: null }, new Date(2026, 7, 1))
    assert.deepEqual(d, { bill: false, reason: "unscheduled" })
  })
})

describe("catchUpPeriods", () => {
  test("three missed months owe three invoices, not one", () => {
    // Collapsing a catch-up into a single invoice silently loses two months of
    // fees, and nobody notices until the year-end reconciliation.
    const periods = catchUpPeriods("MONTHLY", new Date(2026, 4, 1), new Date(2026, 6, 15))
    assert.equal(periods.length, 3)
    assert.deepEqual(periods.map((p) => p.getMonth()), [4, 5, 6])
  })

  test("a schedule that is up to date owes exactly one", () => {
    const periods = catchUpPeriods("MONTHLY", new Date(2026, 6, 1), new Date(2026, 6, 1))
    assert.equal(periods.length, 1)
  })

  test("a future schedule owes nothing", () => {
    const periods = catchUpPeriods("MONTHLY", new Date(2026, 8, 1), new Date(2026, 6, 1))
    assert.equal(periods.length, 0)
  })

  test("catch-up is capped so a mis-dated schedule cannot bill a hundred times", () => {
    const periods = catchUpPeriods("MONTHLY", new Date(2015, 0, 1), new Date(2026, 6, 1))
    assert.equal(periods.length, 12)
  })

  test("quarterly steps three months at a time", () => {
    const periods = catchUpPeriods("QUARTERLY", new Date(2026, 0, 1), new Date(2026, 8, 1))
    assert.deepEqual(periods.map((p) => p.getMonth()), [0, 3, 6])
  })
})
