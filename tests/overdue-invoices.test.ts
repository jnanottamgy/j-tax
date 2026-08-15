/**
 * Which invoices the nightly job may call overdue.
 *
 * The sweep selected by exclusion — everything except PAID, OVERDUE, DISPUTED
 * and WAIVED — so DRAFT invoices were marked overdue and chased. The client had
 * never been sent them. This is the first thing that would have run against the
 * first customer's real ledger.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  canBecomeOverdue,
  isNoLongerOverdue,
  overdueSweepFilter,
  OVERDUE_ELIGIBLE_STATUSES,
} from "@/lib/billing/overdue"

const NOW = new Date(2026, 7, 15)
const LAST_WEEK = new Date(2026, 7, 8)
const NEXT_WEEK = new Date(2026, 7, 22)

describe("canBecomeOverdue", () => {
  test("a draft is never overdue — nobody has been asked to pay it", () => {
    assert.equal(canBecomeOverdue("DRAFT"), false)
  })

  test("an issued invoice can be", () => {
    assert.equal(canBecomeOverdue("SENT"), true)
    assert.equal(canBecomeOverdue("PARTIALLY_PAID"), true)
  })

  test("settled and set-aside invoices cannot", () => {
    for (const s of ["PAID", "WAIVED", "DISPUTED", "CANCELLED"]) {
      assert.equal(canBecomeOverdue(s), false, `${s} must not be swept`)
    }
  })

  test("an unrecognised status is refused rather than assumed chaseable", () => {
    // The point of the allowlist: a status added to the schema later joins an
    // exclusion filter silently and this one only when somebody decides it.
    assert.equal(canBecomeOverdue("SCHEDULED"), false)
    assert.equal(canBecomeOverdue(""), false)
  })
})

describe("overdueSweepFilter", () => {
  test("asks for issued invoices only", () => {
    const f = overdueSweepFilter(NOW)
    assert.deepEqual(f.status, { in: [...OVERDUE_ELIGIBLE_STATUSES] })
    // The shape that caused the bug, kept here as a counter-example.
    assert.ok(!("notIn" in (f.status as object)))
  })

  test("skips invoices with nothing outstanding", () => {
    // A credit note can settle an invoice while it stays PARTIALLY_PAID. The
    // route dropped this filter and would have dunned for ₹0.
    const f = overdueSweepFilter(NOW)
    assert.deepEqual(f.outstandingAmount, { gt: 0 })
  })

  test("only looks before now", () => {
    assert.deepEqual(overdueSweepFilter(NOW).dueDate, { lt: NOW })
  })
})

describe("isNoLongerOverdue", () => {
  const overdue = { status: "OVERDUE", dueDate: LAST_WEEK, outstandingAmount: 5000 }

  test("extending the due date clears it", () => {
    // The one-way flag: nothing wrote the status back, so an invoice the client
    // was given another fortnight on stayed late in every ageing report.
    assert.equal(isNoLongerOverdue({ ...overdue, dueDate: NEXT_WEEK }, NOW), true)
  })

  test("still past due with money owing stays overdue", () => {
    assert.equal(isNoLongerOverdue(overdue, NOW), false)
  })

  test("nothing outstanding clears it", () => {
    assert.equal(isNoLongerOverdue({ ...overdue, outstandingAmount: 0 }, NOW), true)
  })

  test("an invoice that is not marked overdue is left alone", () => {
    assert.equal(isNoLongerOverdue({ ...overdue, status: "SENT" }, NOW), false)
  })
})
