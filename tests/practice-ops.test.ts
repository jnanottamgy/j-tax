/**
 * Capacity, credit notes and client acceptance.
 *
 * Three things a practice is expected to do that the app had no arithmetic for.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  assessCapacity,
  isOnLeave,
  leaveDays,
  workingDaysAvailable,
} from "@/lib/workforce/capacity"
import {
  computeCreditNote,
  taxAdjustmentDeadline,
  taxAdjustmentStatus,
} from "@/lib/billing/credit-note"
import {
  acceptanceVerdict,
  findConflicts,
  normaliseEntityName,
} from "@/lib/clients/conflict-check"

// Mon 2 Mar 2026 .. Fri 6 Mar 2026 is a clean working week.
const MON = new Date(2026, 2, 2)
const FRI = new Date(2026, 2, 6)
const SUN = new Date(2026, 2, 8)

describe("workingDaysAvailable", () => {
  test("a Monday-to-Friday window is five days", () => {
    assert.equal(workingDaysAvailable(MON, FRI, []), 5)
  })

  test("weekends do not count", () => {
    // Mon 2nd to Sun 8th spans seven days but only five are workable.
    assert.equal(workingDaysAvailable(MON, SUN, []), 5)
  })

  test("leave comes out of the count", () => {
    const leave = [{ startDate: new Date(2026, 2, 4), endDate: new Date(2026, 2, 5) }]
    assert.equal(workingDaysAvailable(MON, FRI, leave), 3)
  })

  test("leave over a weekend only removes the weekdays", () => {
    // Mon 2nd to Tue 10th holds seven weekdays. Leave from Fri 6th to Mon 9th
    // spans four calendar days but costs only two working ones.
    const leave = [{ startDate: new Date(2026, 2, 6), endDate: new Date(2026, 2, 9) }]
    assert.equal(workingDaysAvailable(MON, new Date(2026, 2, 10), leave), 5)
  })

  test("an inverted range yields nothing rather than looping", () => {
    assert.equal(workingDaysAvailable(FRI, MON, []), 0)
  })
})

describe("leaveDays / isOnLeave", () => {
  test("both ends of a leave period are included", () => {
    const days = leaveDays([{ startDate: MON, endDate: new Date(2026, 2, 4) }])
    assert.equal(days.size, 3)
  })

  test("a single day is a valid period", () => {
    assert.equal(leaveDays([{ startDate: MON, endDate: MON }]).size, 1)
  })

  test("isOnLeave covers the last day, not just up to it", () => {
    const leave = [{ startDate: MON, endDate: new Date(2026, 2, 4) }]
    assert.equal(isOnLeave(new Date(2026, 2, 4, 17, 0), leave), true)
    assert.equal(isOnLeave(new Date(2026, 2, 5), leave), false)
  })
})

describe("assessCapacity", () => {
  const base = {
    employeeId: "e1",
    employeeName: "Asha",
    windowFrom: MON,
    windowTo: FRI,
    leave: [],
  }

  test("no work is CLEAR and warns about nothing", () => {
    const a = assessCapacity({ ...base, dueInWindow: 0, overdue: 0 })
    assert.equal(a.load, "CLEAR")
    assert.equal(a.warning, null)
  })

  test("overdue work counts against the same days", () => {
    // Five tasks due plus fifteen already late is twenty across five days —
    // ignoring the overdue pile is how a queue looks survivable and isn't.
    const a = assessCapacity({ ...base, dueInWindow: 5, overdue: 15 })
    assert.equal(a.load, "OVER")
    assert.equal(a.tasksPerDay, 4)
  })

  test("leave turns a manageable week into an impossible one", () => {
    // Eight tasks across five days is 1.6 a day — busy, and fine. The same
    // eight with four of those days spent on leave is eight in one day, and
    // until leave was recorded the two looked identical.
    const busy = assessCapacity({ ...base, dueInWindow: 8, overdue: 0 })
    const away = assessCapacity({
      ...base,
      dueInWindow: 8,
      overdue: 0,
      leave: [{ startDate: new Date(2026, 2, 3), endDate: FRI }],
    })
    assert.equal(busy.load, "BUSY")
    assert.equal(away.load, "OVER")
    assert.equal(away.workingDays, 1)
    assert.equal(away.leaveDays, 4)
  })

  test("work with no days at all is called out, not divided by zero", () => {
    const a = assessCapacity({
      ...base,
      dueInWindow: 3,
      overdue: 0,
      leave: [{ startDate: MON, endDate: FRI }],
    })
    assert.equal(a.workingDays, 0)
    assert.equal(a.load, "OVER")
    assert.match(a.warning ?? "", /no working days/)
  })
})

describe("credit notes", () => {
  const inv = {
    taxRate: 18,
    invoiceFee: 50000,
    alreadyCredited: 0,
    alreadySettled: 0,
    invoiceTotal: 59000,
  }

  test("a partial credit carries its own GST", () => {
    const c = computeCreditNote({ ...inv, fee: 5000 })
    assert.equal(c.ok, true)
    if (c.ok) {
      assert.equal(c.taxAmount, 900)
      assert.equal(c.amount, 5900)
      assert.equal(c.remainingOutstanding, 53100)
    }
  })

  test("crediting the whole fee settles the invoice", () => {
    const c = computeCreditNote({ ...inv, fee: 50000 })
    assert.equal(c.ok, true)
    if (c.ok) assert.equal(c.settlesInvoice, true)
  })

  test("crediting more than the invoice is refused", () => {
    const c = computeCreditNote({ ...inv, fee: 60000 })
    assert.equal(c.ok, false)
  })

  test("earlier credits reduce what is left to credit", () => {
    const c = computeCreditNote({ ...inv, alreadyCredited: 45000, fee: 10000 })
    assert.equal(c.ok, false)
    if (!c.ok) assert.match(c.error, /already been credited/)
  })

  test("a client who has overpaid after the credit is owed a refund", () => {
    // Netting this to zero is how a refund goes unnoticed for a year.
    const c = computeCreditNote({ ...inv, alreadySettled: 59000, fee: 10000 })
    assert.equal(c.ok, true)
    if (c.ok) {
      assert.equal(c.remainingOutstanding, 0)
      assert.equal(c.refundDue, 11800)
    }
  })

  test("the s.34 deadline is 30 November after the financial year of supply", () => {
    // An invoice issued in Feb 2026 belongs to FY 2025-26, which ends 31 Mar
    // 2026 — so the window closes 30 Nov 2026, not Nov 2025.
    const d = taxAdjustmentDeadline(new Date(2026, 1, 10))
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 10)
    assert.equal(d.getDate(), 30)
  })

  test("an invoice issued in April belongs to the new year", () => {
    const d = taxAdjustmentDeadline(new Date(2026, 3, 10))
    assert.equal(d.getFullYear(), 2027)
  })

  test("past the deadline the note is still valid but the tax is not recoverable", () => {
    const s = taxAdjustmentStatus(new Date(2024, 5, 1), new Date(2026, 5, 1))
    assert.equal(s.canAdjustTax, false)
    assert.match(s.note, /firm bears it/)
  })
})

describe("conflict check", () => {
  const existing = [
    { clientId: "c1", name: "Acme Traders Private Limited", pan: "AAAPL1234C", gstin: null, groupName: "Acme" },
    { clientId: "c2", name: "Bharat Steel LLP", pan: "BBBPL5678D", gstin: null, groupName: null },
  ]

  test("the same PAN is blocking, because it is the same entity", () => {
    const c = findConflicts({ prospectName: "Acme Trading Co", pan: "AAAPL1234C", existing })
    assert.equal(c[0].severity, "BLOCKING")
    assert.equal(c[0].kind, "SAME_PAN")
  })

  test("a name match survives suffix and punctuation differences", () => {
    const c = findConflicts({ prospectName: "Acme Traders Pvt. Ltd.", existing })
    assert.equal(c.length, 1)
    assert.equal(c[0].kind, "SAME_NAME")
    assert.equal(c[0].severity, "REVIEW")
  })

  test("a declared related party that is already a client is flagged", () => {
    const c = findConflicts({
      prospectName: "Something Else Entirely",
      relatedParties: ["Bharat Steel LLP"],
      existing,
    })
    assert.equal(c[0].kind, "RELATED_PARTY")
  })

  test("an unrelated prospect is clear", () => {
    const c = findConflicts({ prospectName: "Zenith Textiles", existing })
    assert.deepEqual(c, [])
    assert.equal(acceptanceVerdict(c).clear, true)
  })

  test("blocking conflicts sort ahead of ones needing review", () => {
    const c = findConflicts({
      prospectName: "Bharat Steel LLP",
      pan: "AAAPL1234C",
      existing,
    })
    assert.equal(c[0].severity, "BLOCKING")
  })

  test("any conflict requires a written rationale", () => {
    const c = findConflicts({ prospectName: "Acme Traders Ltd", existing })
    const v = acceptanceVerdict(c)
    assert.equal(v.clear, false)
    assert.equal(v.needsRationale, true)
  })

  test("normalisation does not collapse genuinely different names", () => {
    assert.notEqual(
      normaliseEntityName("Acme Traders Pvt Ltd"),
      normaliseEntityName("Acme Textiles Pvt Ltd")
    )
  })
})
