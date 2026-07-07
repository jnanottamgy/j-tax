import { strict as assert } from "node:assert"
import { test } from "node:test"

import {
  fyLabel,
  fyStartYear,
  statutoryEventsInWindow,
  clientGenerationWindow,
} from "../lib/compliance/statutory-calendar"

// Reference "today": 5 Jul 2026 (FY2026-27, Q2).
const NOW = new Date(2026, 6, 5)

function find(events: ReturnType<typeof statutoryEventsInWindow>, title: string) {
  return events.find((e) => e.title === title)
}

test("FY helpers follow the Indian April–March year", () => {
  assert.equal(fyStartYear(new Date(2026, 6, 5)), 2026) // Jul 2026 → FY2026-27
  assert.equal(fyStartYear(new Date(2026, 2, 31)), 2025) // Mar 2026 → FY2025-26
  assert.equal(fyStartYear(new Date(2026, 3, 1)), 2026) // Apr 1 boundary
  assert.equal(fyLabel(2026), "FY2026-27")
  assert.equal(fyLabel(2099), "FY2099-00")
})

test("GSTR-1/3B are due the month AFTER the return period", () => {
  const events = statutoryEventsInWindow(["GST_RETURN"], new Date(2026, 3, 1), new Date(2026, 11, 31))

  const julyGstr1 = find(events, "GSTR-1 — Jul 2026")
  assert.ok(julyGstr1, "July GSTR-1 exists")
  assert.equal(julyGstr1!.dueDate.getTime(), new Date(2026, 7, 11).getTime()) // Aug 11
  assert.equal(julyGstr1!.filingPeriod, "Jul 2026")

  const julyGstr3b = find(events, "GSTR-3B — Jul 2026")
  assert.equal(julyGstr3b!.dueDate.getTime(), new Date(2026, 7, 20).getTime()) // Aug 20

  // The event due Aug 11 must be labelled July — the old engine called it "Aug".
  const dueAug11 = events.filter((e) => e.dueDate.getTime() === new Date(2026, 7, 11).getTime())
  assert.equal(dueAug11.length, 1)
  assert.equal(dueAug11[0].filingPeriod, "Jul 2026")
})

test("TDS: monthly deposit on the 7th, quarterly returns incl. Q4 → May 31 next year", () => {
  const events = statutoryEventsInWindow(["TDS"], new Date(2026, 3, 1), new Date(2027, 6, 31))

  const junDeposit = find(events, "TDS Deposit — Jun 2026")
  assert.equal(junDeposit!.dueDate.getTime(), new Date(2026, 6, 7).getTime()) // Jul 7

  assert.equal(find(events, "TDS Return (24Q/26Q) — Q1 FY2026-27")!.dueDate.getTime(), new Date(2026, 6, 31).getTime()) // Jul 31
  assert.equal(find(events, "TDS Return (24Q/26Q) — Q2 FY2026-27")!.dueDate.getTime(), new Date(2026, 9, 31).getTime()) // Oct 31
  assert.equal(find(events, "TDS Return (24Q/26Q) — Q3 FY2026-27")!.dueDate.getTime(), new Date(2027, 0, 31).getTime()) // Jan 31
  assert.equal(find(events, "TDS Return (24Q/26Q) — Q4 FY2026-27")!.dueDate.getTime(), new Date(2027, 4, 31).getTime()) // May 31 NEXT year
})

test("advance tax lands on Jun/Sep/Dec/Mar 15", () => {
  const events = statutoryEventsInWindow(["INCOME_TAX"], new Date(2026, 3, 1), new Date(2027, 3, 1))
  assert.equal(find(events, "Advance Tax — Q1 FY2026-27")!.dueDate.getTime(), new Date(2026, 5, 15).getTime())
  assert.equal(find(events, "Advance Tax — Q4 FY2026-27")!.dueDate.getTime(), new Date(2027, 2, 15).getTime())
})

test("ITR: Jul 31 non-audit, Oct 31 for audit cases — and the PRIOR FY's return is in window today", () => {
  // Standing in July 2026, the pressing deadline is FY2025-26's ITR (Jul 31 2026).
  const events = statutoryEventsInWindow(["INCOME_TAX"], NOW, new Date(2026, 11, 31))
  const priorFyItr = find(events, "Income Tax Return — FY2025-26")
  assert.ok(priorFyItr, "prior-FY ITR generated")
  assert.equal(priorFyItr!.dueDate.getTime(), new Date(2026, 6, 31).getTime()) // Jul 31 2026

  const auditEvents = statutoryEventsInWindow(["INCOME_TAX", "AUDIT"], NOW, new Date(2026, 11, 31))
  const auditItr = find(auditEvents, "Income Tax Return (Audit Case) — FY2025-26")
  assert.ok(auditItr, "audit-case ITR title")
  assert.equal(auditItr!.dueDate.getTime(), new Date(2026, 9, 31).getTime()) // Oct 31 2026
  assert.ok(!find(auditEvents, "Income Tax Return — FY2025-26"), "non-audit ITR suppressed for audit cases")
})

test("ROC: DIR-3 KYC Sep 30, AOC-4 Oct 30, MGT-7 Nov 28", () => {
  const events = statutoryEventsInWindow(["COMPANY_LAW"], new Date(2026, 3, 1), new Date(2026, 11, 31))
  assert.equal(find(events, "DIR-3 KYC — FY2025-26")!.dueDate.getTime(), new Date(2026, 8, 30).getTime())
  assert.equal(find(events, "AOC-4 (Financial Statements) — FY2025-26")!.dueDate.getTime(), new Date(2026, 9, 30).getTime())
  assert.equal(find(events, "MGT-7 (Annual Return) — FY2025-26")!.dueDate.getTime(), new Date(2026, 10, 28).getTime())
})

test("PF/ESIC is due the 15th of the following month", () => {
  const events = statutoryEventsInWindow(["PAYROLL"], new Date(2026, 3, 1), new Date(2026, 8, 30))
  const jun = find(events, "PF/ESIC Payment — Jun 2026")
  assert.equal(jun!.dueDate.getTime(), new Date(2026, 6, 15).getTime()) // Jul 15
})

test("events are deduplicable by title and sorted by due date", () => {
  const events = statutoryEventsInWindow(
    ["GST_RETURN", "TDS", "INCOME_TAX", "PAYROLL", "COMPANY_LAW", "AUDIT"],
    new Date(2026, 3, 1),
    new Date(2027, 11, 31)
  )
  const titles = events.map((e) => e.title)
  assert.equal(new Set(titles).size, titles.length, "no duplicate titles")
  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].dueDate >= events[i - 1].dueDate, "sorted ascending")
  }
})

test("clientGenerationWindow spans the FY backfill through MGT-7", () => {
  const { from, to, monthlyCap } = clientGenerationWindow(NOW)
  assert.equal(from.getTime(), new Date(2026, 3, 1).getTime()) // Apr 1 2026
  assert.ok(to >= new Date(2027, 10, 28), "window reaches MGT-7 Nov 28 2027")
  assert.ok(monthlyCap <= new Date(2027, 5, 1), "monthlies capped near FY end")

  // End-to-end: the specs a new GST+ITR client gets today include the pressing
  // July 2026 ITR and correctly-labelled monthly GST events.
  const specs = statutoryEventsInWindow(["GST_RETURN", "INCOME_TAX"], from, to)
    .filter((s) => s.cadence !== "MONTHLY" || s.dueDate <= monthlyCap)
  assert.ok(specs.some((s) => s.title === "Income Tax Return — FY2025-26"))
  assert.ok(specs.some((s) => s.title === "Income Tax Return — FY2026-27"))
  assert.ok(specs.some((s) => s.title === "GSTR-1 — Apr 2026"))
  assert.ok(specs.some((s) => s.title === "GSTR-3B — Mar 2027")) // last capped monthly
  assert.ok(!specs.some((s) => s.title === "GSTR-1 — Jun 2027"), "far-future monthlies excluded")
})
