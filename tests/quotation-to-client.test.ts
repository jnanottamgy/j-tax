/**
 * Quotation → client service mapping.
 *
 * This decides which services a converted client is signed up for. The wizard
 * LOCKS these, so a wrong mapping is not something the partner can correct on
 * the way through — they would have to raise a fresh quotation. It also has to
 * satisfy create-client validation, which requires at least one service and a
 * customName whenever OTHER is used.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { mapQuotationItemsToServices } from "@/lib/proposals/quotation-to-client"

const item = (serviceType?: string, description?: string) => ({
  serviceType: serviceType ?? null,
  description: description ?? null,
})

describe("mapQuotationItemsToServices — known services", () => {
  test("maps each catalogue line to its service type and a sensible frequency", () => {
    const out = mapQuotationItemsToServices([
      item("GST Filing (Monthly)"),
      item("Income Tax Return"),
      item("TDS Filing"),
    ])
    assert.deepEqual(
      out.map((s) => [s.serviceType, s.frequency]),
      [
        ["GST_RETURN", "MONTHLY"],
        ["INCOME_TAX", "ANNUAL"],
        ["TDS", "QUARTERLY"],
      ]
    )
  })

  test("quarterly GST maps to the quarterly cadence, not monthly", () => {
    const [s] = mapQuotationItemsToServices([item("GST Filing (Quarterly)")])
    assert.equal(s.serviceType, "GST_RETURN")
    assert.equal(s.frequency, "QUARTERLY")
  })

  test("one-time engagements are not put on a recurring cadence", () => {
    const [s] = mapQuotationItemsToServices([item("Incorporation")])
    assert.equal(s.serviceType, "INCORPORATION")
    assert.equal(s.frequency, "ONE_TIME")
  })
})

describe("mapQuotationItemsToServices — de-duplication", () => {
  test("collapses repeated lines of the same service", () => {
    // ClientService is unique per (client, serviceType) — a duplicate would
    // fail the write outright.
    const out = mapQuotationItemsToServices([
      item("Statutory Audit"),
      item("Internal Audit"),
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].serviceType, "AUDIT")
  })

  test("first cadence wins for a repeated service rather than the last", () => {
    const out = mapQuotationItemsToServices([
      item("GST Filing (Monthly)"),
      item("GST Filing (Quarterly)"),
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].frequency, "MONTHLY")
  })
})

describe("mapQuotationItemsToServices — custom lines", () => {
  test("an unrecognised line becomes OTHER carrying its own name", () => {
    const out = mapQuotationItemsToServices([item("Trademark Registration")])
    assert.equal(out.length, 1)
    assert.equal(out[0].serviceType, "OTHER")
    assert.equal(out[0].customName, "Trademark Registration")
  })

  test("falls back to the description when the line has no service name", () => {
    const out = mapQuotationItemsToServices([item("Custom Service", "Due diligence review")])
    assert.equal(out[0].serviceType, "OTHER")
    assert.equal(out[0].customName, "Due diligence review")
  })

  test("several custom lines merge into one OTHER, since OTHER is unique per client", () => {
    const out = mapQuotationItemsToServices([
      item("Trademark Registration"),
      item("FEMA Advisory"),
    ])
    const other = out.filter((s) => s.serviceType === "OTHER")
    assert.equal(other.length, 1)
    assert.match(other[0].customName!, /Trademark Registration/)
    assert.match(other[0].customName!, /FEMA Advisory/)
  })

  test("customName stays within the column limit", () => {
    const out = mapQuotationItemsToServices(
      Array.from({ length: 40 }, (_, i) => item(`Bespoke advisory engagement number ${i}`))
    )
    assert.ok(out[0].customName!.length <= 120, "customName must not overflow the column")
  })

  test("keeps known and custom lines side by side", () => {
    const out = mapQuotationItemsToServices([
      item("Bookkeeping"),
      item("Trademark Registration"),
    ])
    assert.deepEqual(
      out.map((s) => s.serviceType).sort(),
      ["BOOKKEEPING", "OTHER"]
    )
  })
})

describe("mapQuotationItemsToServices — never produces an unusable result", () => {
  test("an empty quotation still yields one service", () => {
    // create-client validation requires at least one; returning none would
    // dead-end the conversion with a validation error the partner cannot fix,
    // because the services step is locked.
    const out = mapQuotationItemsToServices([])
    assert.equal(out.length, 1)
    assert.equal(out[0].serviceType, "OTHER")
    assert.ok(out[0].customName)
  })

  test("every OTHER carries a customName", () => {
    const out = mapQuotationItemsToServices([item(""), item(null as unknown as string)])
    for (const s of out.filter((x) => x.serviceType === "OTHER")) {
      assert.ok(s.customName && s.customName.trim().length > 0)
    }
  })
})
