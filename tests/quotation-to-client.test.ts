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

describe("mapQuotationItemsToServices — the agreed fee survives conversion", () => {
  test("a line's pre-tax value becomes the engagement fee", () => {
    const out = mapQuotationItemsToServices([
      { id: "qi_1", serviceType: "Statutory Audit", unitPrice: 75000, quantity: 1 },
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].serviceType, "AUDIT")
    assert.equal(out[0].agreedFee, 75000)
    assert.equal(out[0].sourceQuotationItemId, "qi_1")
  })

  test("quantity multiplies into the fee", () => {
    // "GST filing, 12 months @ 5000" is one engagement worth 60000 a year.
    const out = mapQuotationItemsToServices([
      { id: "qi_1", serviceType: "GST Filing (Monthly)", unitPrice: 5000, quantity: 12 },
    ])
    assert.equal(out[0].agreedFee, 60000)
  })

  test("two lines collapsing onto one service type sum their fees", () => {
    // Both map to AUDIT. Keeping only the first would silently halve the
    // engagement's value.
    const out = mapQuotationItemsToServices([
      { id: "a", serviceType: "Statutory Audit", unitPrice: 60000, quantity: 1 },
      { id: "b", serviceType: "Internal Audit", unitPrice: 40000, quantity: 1 },
    ])
    assert.equal(out.length, 1)
    assert.equal(out[0].serviceType, "AUDIT")
    assert.equal(out[0].agreedFee, 100000)
  })

  test("unmapped lines pool into a single OTHER engagement", () => {
    const out = mapQuotationItemsToServices([
      { id: "a", serviceType: "Trademark Registration", unitPrice: 12000, quantity: 1 },
      { id: "b", serviceType: "Advisory Retainer", unitPrice: 8000, quantity: 1 },
    ])
    const other = out.find((s) => s.serviceType === "OTHER")
    assert.ok(other)
    assert.equal(other.agreedFee, 20000)
    assert.equal(other.sourceQuotationItemId, "a")
  })

  test("Prisma Decimals arrive as objects, not numbers", () => {
    // unitPrice crosses from Prisma as a Decimal; Number() must be applied or
    // the fee lands as NaN and the engagement records nothing.
    const decimalLike = { toString: () => "25000.50" }
    const out = mapQuotationItemsToServices([
      { id: "a", serviceType: "Income Tax Return", unitPrice: decimalLike, quantity: 1 },
    ])
    assert.equal(out[0].agreedFee, 25000.5)
  })

  test("a missing price yields no fee rather than a zero one", () => {
    // Zero is a real agreed fee (pro bono); absent is "not agreed yet". The
    // caller distinguishes them, so 0 here must not be mistaken for a price.
    const out = mapQuotationItemsToServices([{ id: "a", serviceType: "TDS Filing" }])
    assert.equal(out[0].agreedFee, 0)
  })

  test("a nonsense price does not produce NaN", () => {
    const out = mapQuotationItemsToServices([
      { id: "a", serviceType: "Payroll Processing", unitPrice: "not a number", quantity: 1 },
    ])
    assert.equal(out[0].agreedFee, 0)
  })

  test("negative prices are floored at zero", () => {
    const out = mapQuotationItemsToServices([
      { id: "a", serviceType: "Bookkeeping", unitPrice: -5000, quantity: 1 },
    ])
    assert.equal(out[0].agreedFee, 0)
  })
})
