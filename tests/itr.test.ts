/**
 * ITR computation engine tests — every expected value hand-computed from the
 * statutory rules for FY 2025-26 (AY 2026-27) and FY 2024-25.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { computeItr, computeInterest, type ItrInputs } from "@/lib/tax/itr"

const NO_DEDUCTIONS = {
  s80C: 0, s80CCD1B: 0, s80D: 0, s80G: 0, s80TTA_TTB: 0, others: 0, nps80CCD2: 0,
}

const base = (over: Partial<ItrInputs>): ItrInputs => ({
  fy: "2025-26",
  ageBand: "BELOW_60",
  salaryGross: 0,
  housePropertyIncome: 0,
  businessIncome: 0,
  otherSourcesIncome: 0,
  stcg111A: 0,
  ltcg112A: 0,
  ltcgOther: 0,
  deductions: { ...NO_DEDUCTIONS },
  tds: 0,
  advanceTax: { q1: 0, q2: 0, q3: 0, q4: 0 },
  filingDate: new Date(2026, 6, 20), // 20 Jul 2026 — before the due date
  ...over,
})

describe("new regime FY 2025-26", () => {
  test("₹12.75L salary → zero tax (std deduction + 87A rebate)", () => {
    const r = computeItr(base({ salaryGross: 12_75_000 }))
    assert.equal(r.new.normalIncome, 12_00_000)
    assert.equal(r.new.slabTax, 60_000) // 4-8L@5% + 8-12L@10%
    assert.equal(r.new.rebate87A, 60_000)
    assert.equal(r.new.totalTax, 0)
    assert.equal(r.recommended, "NEW")
  })

  test("₹12.10L business income → marginal relief caps tax at the excess", () => {
    const r = computeItr(base({ businessIncome: 12_10_000 }))
    assert.equal(r.new.slabTax, 61_500)
    // relief: payable capped at (12,10,000 − 12,00,000) = 10,000 → rebate 51,500
    assert.equal(r.new.rebate87A, 51_500)
    assert.equal(r.new.taxBeforeCess, 10_000)
    assert.equal(r.new.totalTax, 10_400) // + 4% cess
  })

  test("₹51L business income → 10% surcharge with marginal relief at ₹50L", () => {
    const r = computeItr(base({ businessIncome: 51_00_000 }))
    // slab tax on 51L = 20k+40k+60k+80k+1L+27L@30% = 11,10,000
    assert.equal(r.new.slabTax, 11_10_000)
    // uncapped surcharge 1,11,000 → relief: max total = tax(50L)=10,80,000 + 1,00,000 = 11,80,000
    assert.equal(r.new.taxBeforeCess, 11_80_000)
    assert.equal(r.new.surcharge, 70_000)
    assert.equal(r.new.totalTax, 12_27_200)
  })

  test("salary + LTCG 112A: gains taxed at 12.5% over ₹1.25L, no rebate leak", () => {
    const r = computeItr(base({ salaryGross: 15_75_000, ltcg112A: 3_25_000 }))
    assert.equal(r.new.normalIncome, 15_00_000)
    assert.equal(r.new.slabTax, 1_05_000) // 20k+40k+45k
    assert.equal(r.new.ltcg112ATax, 25_000) // (3.25L − 1.25L) @ 12.5%
    assert.equal(r.new.rebate87A, 0)
    assert.equal(r.new.totalTax, 1_35_200) // (1,05,000 + 25,000) × 1.04
  })
})

describe("new regime FY 2024-25", () => {
  test("₹7.75L salary → zero tax under the 7L rebate", () => {
    const r = computeItr(base({ fy: "2024-25", salaryGross: 7_75_000, filingDate: new Date(2025, 6, 20) }))
    assert.equal(r.new.normalIncome, 7_00_000)
    assert.equal(r.new.slabTax, 20_000) // 3-7L @ 5%
    assert.equal(r.new.rebate87A, 20_000)
    assert.equal(r.new.totalTax, 0)
  })
})

describe("old regime", () => {
  test("₹10L salary with 80C 1.5L", () => {
    const r = computeItr(base({ salaryGross: 10_00_000, deductions: { ...NO_DEDUCTIONS, s80C: 1_50_000 } }))
    // 10L − 50k std − 1.5L = 8L → 12,500 + 60,000 = 72,500 (+4% cess)
    assert.equal(r.old.normalIncome, 8_00_000)
    assert.equal(r.old.slabTax, 72_500)
    assert.equal(r.old.totalTax, 75_400)
  })

  test("80C capped at 1.5L even if more is entered", () => {
    const r = computeItr(base({ salaryGross: 10_00_000, deductions: { ...NO_DEDUCTIONS, s80C: 3_00_000 } }))
    assert.equal(r.old.chapterVIA, 1_50_000)
  })

  test("senior citizen exemption + 87A below ₹5L", () => {
    const r = computeItr(base({ ageBand: "SENIOR_60_79", otherSourcesIncome: 4_90_000 }))
    assert.equal(r.old.slabTax, 9_500) // 3L exemption → 1.9L @ 5%
    assert.equal(r.old.rebate87A, 9_500)
    assert.equal(r.old.totalTax, 0)
  })

  test("HP loss set-off capped at ₹2L (old) and disallowed (new)", () => {
    const r = computeItr(base({ salaryGross: 10_50_000, housePropertyIncome: -3_50_000 }))
    assert.equal(r.old.normalIncome, 10_50_000 - 50_000 - 2_00_000)
    assert.equal(r.new.normalIncome, 10_50_000 - 75_000)
  })

  test("112A-only income: basic exemption shifts against the gain", () => {
    const r = computeItr(base({ ltcg112A: 4_00_000 }))
    // (4L − 1.25L exemption) = 2.75L → minus unexhausted 2.5L → 25k @ 12.5%
    assert.equal(r.old.ltcg112ATax, 3_125)
    // 87A never offsets 112A tax even though total income ≤ 5L
    assert.equal(r.old.rebate87A, 0)
    assert.equal(r.old.totalTax, 3_250)
  })
})

describe("regime comparison", () => {
  test("heavy 80C investor → old regime can win", () => {
    const r = computeItr(base({
      salaryGross: 9_00_000,
      deductions: { ...NO_DEDUCTIONS, s80C: 1_50_000, s80D: 25_000, s80CCD1B: 50_000 },
    }))
    // old: 9L − 50k − 2.25L = 6.25L → 12,500 + 25,000 = 37,500 ×1.04 = 39,000
    // new: 9L − 75k = 8.25L → 20,000 + 2,500 = 22,500 → rebate → 0
    assert.equal(r.old.totalTax, 39_000)
    assert.equal(r.new.totalTax, 0)
    assert.equal(r.recommended, "NEW")
    assert.equal(r.savings, 39_000)
  })

  test("netPayable = winner's tax + interest − prepaid", () => {
    const r = computeItr(base({ salaryGross: 24_75_000, tds: 3_00_000 }))
    // new: 24L normal → 20k+40k+60k+80k+1L = 3,00,000 → ×1.04 = 3,12,000
    assert.equal(r.new.totalTax, 3_12_000)
    // TDS ≥ 90% → no 234B, but the ₹12,000 gap owed advance tax → 234C:
    // 1,800×3% + 5,400×3% + 9,000×3% + 12,000×1% = 54+162+270+120 = 606
    assert.equal(r.interest.i234B, 0)
    assert.equal(r.interest.i234C, 606)
    assert.equal(r.netPayable, 3_12_000 + 606 - 3_00_000)
  })
})

describe("interest 234A/B/C", () => {
  test("nothing prepaid, filed in time: full 234C ladder + 234B for 4 months", () => {
    const i = computeInterest({
      fy: "2025-26",
      totalTax: 1_00_000,
      tds: 0,
      advanceTax: { q1: 0, q2: 0, q3: 0, q4: 0 },
      filingDate: new Date(2026, 6, 20), // 20 Jul 2026
    })
    // 234C: 15k×3% + 45k×3% + 75k×3% + 100k×1% = 450+1350+2250+1000
    assert.equal(i.i234C, 5_050)
    // 234B: Apr→Jul(part) = 4 months × 1% × 1,00,000
    assert.equal(i.i234B, 4_000)
    assert.equal(i.i234A, 0)
  })

  test("safe harbour: 12%/36% paid in early instalments avoids their 234C", () => {
    const i = computeInterest({
      fy: "2025-26",
      totalTax: 1_00_000,
      tds: 0,
      advanceTax: { q1: 12_000, q2: 24_000, q3: 39_000, q4: 25_000 }, // cum: 12k/36k/75k/100k
      filingDate: new Date(2026, 5, 10),
    })
    assert.equal(i.i234C, 0)
    assert.equal(i.i234B, 0) // fully paid ≥90%
  })

  test("234A kicks in only after the due date", () => {
    const late = computeInterest({
      fy: "2025-26",
      totalTax: 50_000,
      tds: 0,
      advanceTax: { q1: 0, q2: 0, q3: 0, q4: 0 },
      filingDate: new Date(2026, 7, 5), // 5 Aug 2026 → 1 month late
    })
    assert.equal(late.i234A, 500)
  })

  test("no advance-tax interest when liability under ₹10,000", () => {
    const i = computeInterest({
      fy: "2025-26",
      totalTax: 9_000,
      tds: 0,
      advanceTax: { q1: 0, q2: 0, q3: 0, q4: 0 },
      filingDate: new Date(2026, 6, 20),
    })
    assert.equal(i.i234B + i.i234C, 0)
  })

  test("TDS counts toward the 90% test", () => {
    const i = computeInterest({
      fy: "2025-26",
      totalTax: 1_00_000,
      tds: 95_000,
      advanceTax: { q1: 0, q2: 0, q3: 0, q4: 0 },
      filingDate: new Date(2026, 6, 20),
    })
    assert.equal(i.i234B, 0)
    assert.equal(i.i234C, 0) // net for advance = 5,000 < 10,000 threshold
  })
})
