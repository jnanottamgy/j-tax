/**
 * Unit tests for lib/india — statutory validators and India-first formatting.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  validateGSTIN,
  isValidGSTIN,
  gstinCheckDigit,
  validatePAN,
  isValidPAN,
  gstinPanMismatch,
  isValidTAN,
  isValidIFSC,
  normalizeGSTIN,
} from "@/lib/india/validators"
import {
  formatINR,
  formatINRCompact,
  formatIndianNumber,
  amountInWords,
  financialYearOf,
  parseFinancialYear,
  recentFinancialYears,
} from "@/lib/india/format"

describe("GSTIN validation — mod-36 check digit", () => {
  test("accepts the canonical published sample GSTIN", () => {
    const r = validateGSTIN("27AAPFU0939F1ZV")
    assert.equal(r.valid, true, `should be valid: ${!r.valid ? r.error : ""}`)
  })

  test("accepts GSTINs across states when check digit is computed", () => {
    for (const base of ["29AABCU9603R1Z", "07AABCU9603R1Z", "33AAACI1681G1Z"]) {
      const g = base + gstinCheckDigit(base)
      assert.equal(isValidGSTIN(g), true, `${g} should be valid`)
    }
  })

  test("check digit is self-consistent", () => {
    // For any structurally valid base-14, appending its computed check digit
    // must validate; appending any other char must not.
    const base = "27AAPFU0939F1Z".slice(0, 14)
    const check = gstinCheckDigit(base)
    assert.equal(isValidGSTIN(base + check), true)
  })

  test("rejects a single-character typo", () => {
    // Flip one digit of a valid GSTIN — checksum must catch it
    assert.equal(isValidGSTIN("27AAPFU0939F1ZW"), false)
    assert.equal(isValidGSTIN("27AAPFU0938F1ZV"), false)
  })

  test("rejects wrong shape and unknown state code", () => {
    assert.equal(isValidGSTIN("99AAPFU0939F1ZV"), false) // state 99 invalid
    assert.equal(isValidGSTIN("27AAPFU0939F1AV"), false) // 14th char must be Z
    assert.equal(isValidGSTIN("27aapfu0939f1"), false) // too short
    assert.equal(isValidGSTIN(""), false)
    assert.equal(isValidGSTIN(null), false)
  })

  test("normalizes whitespace and case", () => {
    assert.equal(normalizeGSTIN(" 27aapfu0939f1zv "), "27AAPFU0939F1ZV")
    assert.equal(isValidGSTIN(" 27aapfu0939f1zv "), true)
  })

  test("extracts state and embedded PAN", () => {
    const r = validateGSTIN("27AAPFU0939F1ZV")
    assert.equal(r.valid, true)
    if (r.valid) {
      assert.equal(r.stateCode, "27")
      assert.equal(r.stateName, "Maharashtra")
      assert.equal(r.pan, "AAPFU0939F")
      assert.equal(r.entityCode, "1")
    }
  })
})

describe("PAN validation", () => {
  test("accepts valid PANs and extracts entity type", () => {
    const r = validatePAN("AAPFU0939F")
    assert.equal(r.valid, true)
    if (r.valid) assert.equal(r.entityType, "Firm / LLP")

    const p = validatePAN("abcpe1234f") // lowercase individual
    assert.equal(p.valid, true)
    if (p.valid) assert.equal(p.entityType, "Individual")
  })

  test("rejects bad shapes and invalid entity letter", () => {
    assert.equal(isValidPAN("AAPFU0939"), false) // 9 chars
    assert.equal(isValidPAN("1APFU0939F"), false) // digit first
    assert.equal(isValidPAN("AAXZU0939F"), false) // X not an entity type... 4th char is Z
    assert.equal(validatePAN("AAAZA1234A").valid, false) // Z invalid 4th char
    assert.equal(isValidPAN(null), false)
  })
})

describe("GSTIN ↔ PAN cross-check", () => {
  test("null when they agree", () => {
    assert.equal(gstinPanMismatch("27AAPFU0939F1ZV", "AAPFU0939F"), null)
  })
  test("message when they disagree", () => {
    const msg = gstinPanMismatch("27AAPFU0939F1ZV", "ABCPE1234F")
    assert.ok(msg && msg.includes("AAPFU0939F"))
  })
  test("null when either is missing/invalid (their own validators report)", () => {
    assert.equal(gstinPanMismatch(null, "ABCPE1234F"), null)
    assert.equal(gstinPanMismatch("bad", "ABCPE1234F"), null)
  })
})

describe("TAN and IFSC", () => {
  test("TAN shape", () => {
    assert.equal(isValidTAN("BLRA12345C"), true)
    assert.equal(isValidTAN("blra12345c"), true)
    assert.equal(isValidTAN("BLR12345C"), false)
    assert.equal(isValidTAN("BLRA1234C"), false)
  })
  test("IFSC shape", () => {
    assert.equal(isValidIFSC("HDFC0001234"), true)
    assert.equal(isValidIFSC("SBIN0005943"), true)
    assert.equal(isValidIFSC("HDFC1001234"), false) // 5th char must be 0
    assert.equal(isValidIFSC("HDF00012345"), false)
  })
})

describe("formatINR — Indian digit grouping", () => {
  test("groups lakh/crore style", () => {
    assert.equal(formatINR(12345678).replace(/ /g, " "), "₹1,23,45,678")
    assert.equal(formatIndianNumber(12345678), "1,23,45,678")
  })
  test("paise mode", () => {
    assert.equal(formatINR(1234.5, { paise: true }).replace(/ /g, " "), "₹1,234.50")
  })
  test("never renders NaN", () => {
    assert.equal(formatINR(undefined), "₹0")
    assert.equal(formatINR(Number.NaN), "₹0")
    assert.equal(formatINR("not-a-number"), "₹0")
  })
})

describe("formatINRCompact", () => {
  test("crore / lakh / plain tiers", () => {
    assert.equal(formatINRCompact(12_40_00_000), "₹12.4 Cr")
    assert.equal(formatINRCompact(4_56_000), "₹4.56 L")
    assert.equal(formatINRCompact(12_500).replace(/ /g, " "), "₹12,500")
  })
  test("trims trailing zeros and handles negatives", () => {
    assert.equal(formatINRCompact(1_50_00_000), "₹1.5 Cr")
    assert.equal(formatINRCompact(-2_00_000), "-₹2 L")
  })
})

describe("amountInWords — Indian system", () => {
  test("statutory invoice phrasing", () => {
    assert.equal(
      amountInWords(1234567.5),
      "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Paise Fifty Only"
    )
  })
  test("crore recursion", () => {
    assert.equal(amountInWords(10_00_00_000), "Rupees Ten Crore Only")
    assert.equal(
      amountInWords(1_23_45_67_890),
      "Rupees One Hundred Twenty-Three Crore Forty-Five Lakh Sixty-Seven Thousand Eight Hundred Ninety Only"
    )
  })
  test("zero, paise carry, negatives", () => {
    assert.equal(amountInWords(0), "Rupees Zero Only")
    // 99.999 rounds to 100.00 — carry into rupees, no stray paise
    assert.equal(amountInWords(99.999), "Rupees One Hundred Only")
    assert.equal(amountInWords(-500), "Minus Rupees Five Hundred Only")
  })
})

describe("financial year helpers", () => {
  test("FY boundary — March vs April", () => {
    assert.equal(financialYearOf(new Date(2026, 2, 31)).short, "2025-26") // 31 Mar
    assert.equal(financialYearOf(new Date(2026, 3, 1)).short, "2026-27") // 1 Apr
  })
  test("assessment year is FY + 1", () => {
    assert.equal(financialYearOf(new Date(2026, 6, 5)).assessmentYear, "2027-28")
  })
  test("parse accepts common spellings", () => {
    assert.equal(parseFinancialYear("2026-27")?.startYear, 2026)
    assert.equal(parseFinancialYear("FY 2026-27")?.startYear, 2026)
    assert.equal(parseFinancialYear("2026")?.startYear, 2026)
    assert.equal(parseFinancialYear("2026-28"), null) // inconsistent end year
    assert.equal(parseFinancialYear("garbage"), null)
  })
  test("recent FYs newest first", () => {
    const list = recentFinancialYears(3, new Date(2026, 6, 5))
    assert.deepEqual(list.map((f) => f.short), ["2026-27", "2025-26", "2024-25"])
  })
})
