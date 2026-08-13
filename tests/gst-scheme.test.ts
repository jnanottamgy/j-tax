/**
 * GST cadence and audit applicability, derived from turnover.
 *
 * Filing frequency was previously a free dropdown with nothing behind it. These
 * pin the thresholds, because getting one wrong means either filing returns a
 * client does not owe or missing ones they do.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import {
  resolveGstScheme,
  qrmpGstr3bDueDay,
  indicateTaxAudit,
  fyEndLabel,
  QRMP_TURNOVER_LIMIT,
} from "@/lib/compliance/gst-scheme"
import { statutoryEventsInWindow } from "@/lib/compliance/statutory-calendar"

describe("resolveGstScheme", () => {
  test("above ₹5 crore is monthly, mandatorily", () => {
    const r = resolveGstScheme({ annualTurnover: 60_000_000 })
    assert.equal(r.scheme, "MONTHLY")
    assert.equal(r.source, "turnover")
  })

  test("at exactly ₹5 crore the client is still QRMP-eligible", () => {
    // The rule is "up to ₹5 crore", so the boundary itself qualifies.
    const r = resolveGstScheme({ annualTurnover: QRMP_TURNOVER_LIMIT })
    assert.equal(r.scheme, "QRMP")
  })

  test("below the limit is QRMP-eligible", () => {
    assert.equal(resolveGstScheme({ annualTurnover: 20_000_000 }).scheme, "QRMP")
  })

  test("an explicit choice beats the turnover figure", () => {
    // A small client may opt to keep filing monthly, and a stale turnover
    // number must never silently override a decision the firm made.
    const r = resolveGstScheme({ explicit: "MONTHLY", annualTurnover: 1_000_000 })
    assert.equal(r.scheme, "MONTHLY")
    assert.equal(r.source, "explicit")
  })

  test("no turnover defaults to monthly, not quarterly", () => {
    // Over-filing is recoverable; a missed GSTR-3B carries interest and late
    // fees. The unknown case must fail toward more filings, not fewer.
    const r = resolveGstScheme({})
    assert.equal(r.scheme, "MONTHLY")
    assert.equal(r.source, "default")
  })

  test("a zero or negative turnover is treated as unknown", () => {
    assert.equal(resolveGstScheme({ annualTurnover: 0 }).source, "default")
    assert.equal(resolveGstScheme({ annualTurnover: -5 }).source, "default")
  })
})

describe("qrmpGstr3bDueDay", () => {
  test("Maharashtra files on the 22nd", () => {
    assert.equal(qrmpGstr3bDueDay("27"), 22)
  })
  test("Delhi files on the 24th", () => {
    assert.equal(qrmpGstr3bDueDay("07"), 24)
  })
  test("an unknown state falls to the later date", () => {
    // The 24th is the safer default: filing early is never a penalty.
    assert.equal(qrmpGstr3bDueDay(null), 24)
  })
})

describe("statutoryEventsInWindow — QRMP changes what is actually due", () => {
  const from = new Date(2026, 3, 1) // 1 Apr 2026
  const to = new Date(2027, 2, 31) // 31 Mar 2027

  const monthly = statutoryEventsInWindow(["GST_RETURN"], from, to)
  const qrmp = statutoryEventsInWindow(["GST_RETURN"], from, to, {
    gstScheme: "QRMP",
    stateCode: "27",
  })

  test("a monthly filer gets monthly GSTR-1 and 3B", () => {
    assert.ok(monthly.some((e) => e.title.startsWith("GSTR-1 —")))
    assert.ok(monthly.some((e) => e.title.startsWith("GSTR-3B —")))
    assert.equal(monthly.every((e) => e.cadence === "MONTHLY"), true)
  })

  test("a QRMP filer gets no monthly returns", () => {
    assert.equal(
      qrmp.some((e) => /^GSTR-(1|3B) —/.test(e.title)),
      false
    )
  })

  test("a QRMP filer gets quarterly returns instead", () => {
    const quarterly = qrmp.filter((e) => e.cadence === "QUARTERLY")
    assert.equal(quarterly.filter((e) => e.title.includes("GSTR-1 (QRMP)")).length, 4)
    assert.equal(quarterly.filter((e) => e.title.includes("GSTR-3B (QRMP)")).length, 4)
  })

  test("a QRMP filer still pays tax monthly via PMT-06", () => {
    // Eight, not twelve: no PMT-06 in the last month of a quarter, because the
    // quarterly 3B settles it. Missing this is what costs the client interest.
    const pmt = qrmp.filter((e) => e.title.startsWith("GST PMT-06"))
    assert.equal(pmt.length, 8)
  })

  test("Maharashtra's quarterly 3B lands on the 22nd", () => {
    const q1 = qrmp.find((e) => e.title.includes("GSTR-3B (QRMP) — Q1"))
    assert.ok(q1)
    assert.equal(q1.dueDate.getDate(), 22)
  })

  test("a Delhi client's quarterly 3B lands on the 24th", () => {
    const delhi = statutoryEventsInWindow(["GST_RETURN"], from, to, {
      gstScheme: "QRMP",
      stateCode: "07",
    })
    const q1 = delhi.find((e) => e.title.includes("GSTR-3B (QRMP) — Q1"))
    assert.ok(q1)
    assert.equal(q1.dueDate.getDate(), 24)
  })

  test("omitting the profile keeps the previous monthly behaviour", () => {
    // Existing callers and clients with no turnover recorded must be unchanged.
    assert.deepEqual(
      statutoryEventsInWindow(["GST_RETURN"], from, to).map((e) => e.title),
      monthly.map((e) => e.title)
    )
  })
})

describe("indicateTaxAudit", () => {
  test("above ₹10 crore it applies outright", () => {
    const r = indicateTaxAudit({ annualTurnover: 150_000_000 })
    assert.equal(r.likely, true)
    assert.equal(r.checkCashRatio, false)
  })

  test("between ₹1 crore and ₹10 crore it depends on the cash ratio", () => {
    // The app cannot know the ratio, so it must flag rather than assert.
    const r = indicateTaxAudit({ annualTurnover: 50_000_000 })
    assert.equal(r.likely, false)
    assert.equal(r.checkCashRatio, true)
  })

  test("below ₹1 crore it does not apply to a business", () => {
    const r = indicateTaxAudit({ annualTurnover: 5_000_000 })
    assert.equal(r.likely, false)
    assert.equal(r.checkCashRatio, false)
  })

  test("a profession has its own, lower limit", () => {
    assert.equal(indicateTaxAudit({ annualTurnover: 8_000_000, isProfession: true }).likely, true)
    assert.equal(indicateTaxAudit({ annualTurnover: 8_000_000 }).likely, false)
  })

  test("no turnover asserts nothing", () => {
    const r = indicateTaxAudit({ annualTurnover: null })
    assert.equal(r.likely, false)
    assert.equal(r.checkCashRatio, false)
  })
})

describe("fyEndLabel", () => {
  test("defaults to 31 March when unset", () => {
    assert.equal(fyEndLabel(null), "31 March")
    assert.equal(fyEndLabel(undefined), "31 March")
  })
  test("December closes on the 31st", () => {
    assert.equal(fyEndLabel(12), "31 December")
  })
  test("June closes on the 30th, not the 31st", () => {
    assert.equal(fyEndLabel(6), "30 June")
  })
  test("out-of-range input is clamped rather than crashing", () => {
    assert.equal(fyEndLabel(0), "31 January")
    assert.equal(fyEndLabel(99), "31 December")
  })
})
