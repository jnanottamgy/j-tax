/**
 * ITR computation engine — individual/HUF income tax for both regimes,
 * side-by-side. Pure functions, no I/O.
 *
 * Covers (FY 2024-25 and FY 2025-26 rule sets):
 *  - Slab tax per regime, age-banded exemption (old regime)
 *  - Standard deduction (₹50k old / ₹75k new), Chapter VI-A (old only,
 *    except employer NPS 80CCD(2) which both regimes allow)
 *  - Special-rate income: STCG 111A @20%, LTCG 112A @12.5% (over ₹1.25L),
 *    other LTCG 112 @12.5% — with unexhausted basic-exemption shifting for
 *    residents (offset against the highest-rate gains first)
 *  - 87A rebate incl. the new-regime marginal relief above the threshold;
 *    special-rate tax is never rebated (112A also excluded in the old regime)
 *  - Surcharge with threshold marginal relief; capital-gains surcharge
 *    capped at 15%
 *  - 4% health & education cess
 *  - Interest: 234A (late filing), 234B (advance-tax shortfall <90%),
 *    234C (instalment deferment with 12%/36% safe harbours)
 *
 * Known simplifications (documented, conservative):
 *  - Deductions reduce normal-rate income only (they cannot legally reduce
 *    111A/112/112A gains).
 *  - House-property loss set-off is capped at ₹2,00,000 in the old regime and
 *    not allowed against other heads in the new regime.
 *  - Surcharge marginal relief is evaluated on aggregate tax.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type FinancialYearKey = "2025-26" | "2024-25"
export type AgeBand = "BELOW_60" | "SENIOR_60_79" | "SUPER_SENIOR_80_PLUS"

export type ItrDeductions = {
  /** 80C/80CCC/80CCD(1) basket (cap 1.5L) */
  s80C: number
  /** 80CCD(1B) NPS self (cap 50k) */
  s80CCD1B: number
  /** 80D medical insurance (caps vary; entered as claimed) */
  s80D: number
  /** 80G donations (entered as eligible amount) */
  s80G: number
  /** 80TTA/80TTB interest */
  s80TTA_TTB: number
  /** Any other old-regime deductions (HRA exemption, 24(b) interest entered under HP, etc.) */
  others: number
  /** Employer NPS 80CCD(2) — allowed in BOTH regimes */
  nps80CCD2: number
}

export type ItrInputs = {
  fy: FinancialYearKey
  ageBand: AgeBand
  /** Gross salary before standard deduction */
  salaryGross: number
  /** Net income from house property (negative = loss) */
  housePropertyIncome: number
  businessIncome: number
  otherSourcesIncome: number
  /** STCG on listed equity/units (sec 111A) */
  stcg111A: number
  /** LTCG on listed equity/units (sec 112A, ₹1.25L exempt) */
  ltcg112A: number
  /** Other LTCG (sec 112) */
  ltcgOther: number
  deductions: ItrDeductions
  /** Taxes already paid */
  tds: number
  advanceTax: { q1: number; q2: number; q3: number; q4: number }
  /** For 234A/234B month counting; defaults to today */
  filingDate?: Date
}

export type RegimeResult = {
  regime: "OLD" | "NEW"
  grossTotalIncome: number
  standardDeduction: number
  chapterVIA: number
  /** Normal-rate taxable income (after exemption-independent rounding) */
  normalIncome: number
  totalIncome: number
  basicExemption: number
  slabTax: number
  stcg111ATax: number
  ltcg112ATax: number
  ltcgOtherTax: number
  rebate87A: number
  surcharge: number
  /** tax + surcharge before cess */
  taxBeforeCess: number
  cess: number
  totalTax: number
  /** Human-readable slab working, for the computation sheet */
  slabLines: Array<{ label: string; amount: number; tax: number }>
}

export type InterestResult = {
  i234A: number
  i234B: number
  i234C: number
  total: number
}

export type ItrComparison = {
  old: RegimeResult
  new: RegimeResult
  recommended: "OLD" | "NEW"
  savings: number
  /** For the recommended regime */
  interest: InterestResult
  totalPrepaid: number
  netPayable: number
}

// ─── FY rule configs ─────────────────────────────────────────────────────────

type Slab = { upTo: number | null; rate: number }

type RegimeConfig = {
  slabs: Slab[]
  /** Basic exemption is the first nil slab's upper bound */
  standardDeduction: number
  rebateLimit: number
  rebateCap: number
  /** New-regime style marginal relief just above the rebate limit */
  rebateMarginalRelief: boolean
  surchargeBands: Array<{ above: number; rate: number }>
}

type FyConfig = {
  label: string
  assessmentYear: string
  old: (age: AgeBand) => RegimeConfig
  new: RegimeConfig
  /** Return filing due date (non-audit) for 234A */
  dueDate: Date
  ltcg112AExemption: number
  stcg111ARate: number
  ltcgRate: number
}

const OLD_SURCHARGE = [
  { above: 50_00_000, rate: 0.1 },
  { above: 1_00_00_000, rate: 0.15 },
  { above: 2_00_00_000, rate: 0.25 },
  { above: 5_00_00_000, rate: 0.37 },
]
// New regime caps surcharge at 25%
const NEW_SURCHARGE = [
  { above: 50_00_000, rate: 0.1 },
  { above: 1_00_00_000, rate: 0.15 },
  { above: 2_00_00_000, rate: 0.25 },
]

function oldRegimeConfig(age: AgeBand): RegimeConfig {
  const exemption =
    age === "SUPER_SENIOR_80_PLUS" ? 5_00_000 : age === "SENIOR_60_79" ? 3_00_000 : 2_50_000
  return {
    slabs: [
      { upTo: exemption, rate: 0 },
      { upTo: 5_00_000, rate: 0.05 },
      { upTo: 10_00_000, rate: 0.2 },
      { upTo: null, rate: 0.3 },
    ],
    standardDeduction: 50_000,
    rebateLimit: 5_00_000,
    rebateCap: 12_500,
    rebateMarginalRelief: false,
    surchargeBands: OLD_SURCHARGE,
  }
}

export const FY_CONFIGS: Record<FinancialYearKey, FyConfig> = {
  "2025-26": {
    label: "FY 2025-26",
    assessmentYear: "AY 2026-27",
    old: oldRegimeConfig,
    new: {
      slabs: [
        { upTo: 4_00_000, rate: 0 },
        { upTo: 8_00_000, rate: 0.05 },
        { upTo: 12_00_000, rate: 0.1 },
        { upTo: 16_00_000, rate: 0.15 },
        { upTo: 20_00_000, rate: 0.2 },
        { upTo: 24_00_000, rate: 0.25 },
        { upTo: null, rate: 0.3 },
      ],
      standardDeduction: 75_000,
      rebateLimit: 12_00_000,
      rebateCap: 60_000,
      rebateMarginalRelief: true,
      surchargeBands: NEW_SURCHARGE,
    },
    dueDate: new Date(2026, 6, 31), // 31 Jul 2026
    ltcg112AExemption: 1_25_000,
    stcg111ARate: 0.2,
    ltcgRate: 0.125,
  },
  "2024-25": {
    label: "FY 2024-25",
    assessmentYear: "AY 2025-26",
    old: oldRegimeConfig,
    new: {
      slabs: [
        { upTo: 3_00_000, rate: 0 },
        { upTo: 7_00_000, rate: 0.05 },
        { upTo: 10_00_000, rate: 0.1 },
        { upTo: 12_00_000, rate: 0.15 },
        { upTo: 15_00_000, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ],
      standardDeduction: 75_000,
      rebateLimit: 7_00_000,
      rebateCap: 25_000,
      rebateMarginalRelief: true,
      surchargeBands: NEW_SURCHARGE,
    },
    dueDate: new Date(2025, 6, 31),
    ltcg112AExemption: 1_25_000,
    stcg111ARate: 0.2,
    ltcgRate: 0.125,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const r0 = (n: number) => Math.round(n)
const clampPos = (n: number) => Math.max(0, n)

function slabTaxWithLines(income: number, slabs: Slab[]): { tax: number; lines: RegimeResult["slabLines"] } {
  let tax = 0
  let prev = 0
  const lines: RegimeResult["slabLines"] = []
  for (const s of slabs) {
    const upper = s.upTo ?? Infinity
    if (income <= prev) break
    const amount = Math.min(income, upper) - prev
    const t = amount * s.rate
    tax += t
    if (amount > 0 && s.rate > 0) {
      lines.push({
        label: `${(prev / 1_00_000).toFixed(2)}L–${upper === Infinity ? "∞" : (upper / 1_00_000).toFixed(2) + "L"} @ ${(s.rate * 100).toFixed(0)}%`,
        amount,
        tax: r0(t),
      })
    }
    prev = upper
  }
  return { tax, lines }
}

/** Surcharge with threshold marginal relief; CG portion capped at 15%. */
function computeSurcharge(opts: {
  totalIncome: number
  taxAfterRebate: number
  cgTax: number
  bands: Array<{ above: number; rate: number }>
  slabsForRelief: Slab[]
  normalIncome: number
}): number {
  const { totalIncome, taxAfterRebate, cgTax, bands } = opts
  let rate = 0
  let threshold = 0
  let rateBelow = 0
  for (const b of bands) {
    if (totalIncome > b.above) {
      rateBelow = rate
      rate = b.rate
      threshold = b.above
    }
  }
  if (rate === 0) return 0

  const nonCgTax = clampPos(taxAfterRebate - cgTax)
  let surcharge = nonCgTax * rate + cgTax * Math.min(rate, 0.15)

  // Marginal relief: total (tax + surcharge) may not exceed what a taxpayer
  // at exactly the threshold pays, plus the income above the threshold.
  // The hypothetical threshold income is built by shaving the excess off
  // normal income first, then proportionally off capital gains.
  const over = totalIncome - threshold
  let normalAtThreshold = opts.normalIncome
  let cgTaxAtThreshold = cgTax
  if (over <= opts.normalIncome) {
    normalAtThreshold = opts.normalIncome - over
  } else {
    normalAtThreshold = 0
    const cgBase = totalIncome - opts.normalIncome
    const cgRemaining = clampPos(cgBase - (over - opts.normalIncome))
    cgTaxAtThreshold = cgBase > 0 ? (cgTax * cgRemaining) / cgBase : 0
  }
  const taxAtThreshold =
    slabTaxWithLines(normalAtThreshold, opts.slabsForRelief).tax + cgTaxAtThreshold
  const maxTotal = taxAtThreshold * (1 + rateBelow) + over
  if (taxAfterRebate + surcharge > maxTotal) {
    surcharge = clampPos(maxTotal - taxAfterRebate)
  }
  return surcharge
}

// ─── Per-regime computation ──────────────────────────────────────────────────

function computeRegime(inputs: ItrInputs, regime: "OLD" | "NEW"): RegimeResult {
  const fy = FY_CONFIGS[inputs.fy]
  const cfg = regime === "OLD" ? fy.old(inputs.ageBand) : fy.new
  const d = inputs.deductions

  const salaryNet = clampPos(inputs.salaryGross - (inputs.salaryGross > 0 ? cfg.standardDeduction : 0))
  const standardDeduction = inputs.salaryGross > 0 ? Math.min(inputs.salaryGross, cfg.standardDeduction) : 0

  // House-property loss handling differs by regime
  const hp =
    inputs.housePropertyIncome >= 0
      ? inputs.housePropertyIncome
      : regime === "OLD"
        ? Math.max(inputs.housePropertyIncome, -2_00_000)
        : 0

  const chapterVIA =
    regime === "OLD"
      ? Math.min(d.s80C, 1_50_000) + Math.min(d.s80CCD1B, 50_000) + d.s80D + d.s80G + d.s80TTA_TTB + d.others + d.nps80CCD2
      : d.nps80CCD2

  const grossNormal = salaryNet + hp + inputs.businessIncome + inputs.otherSourcesIncome
  const normalIncome = clampPos(grossNormal - chapterVIA)

  const stcg = clampPos(inputs.stcg111A)
  const ltcgAOverExemption = clampPos(inputs.ltcg112A - fy.ltcg112AExemption)
  const ltcgOther = clampPos(inputs.ltcgOther)

  // Unexhausted basic exemption shifts to special-rate income (residents) —
  // offset the highest-rate gains first (assessee-favourable, permitted).
  const basicExemption = cfg.slabs[0].upTo ?? 0
  let unexhausted = clampPos(basicExemption - normalIncome)
  const stcgTaxable = clampPos(stcg - unexhausted)
  unexhausted = clampPos(unexhausted - stcg)
  const ltcgATaxable = clampPos(ltcgAOverExemption - unexhausted)
  unexhausted = clampPos(unexhausted - ltcgAOverExemption)
  const ltcgOtherTaxable = clampPos(ltcgOther - unexhausted)

  const { tax: slabTax, lines } = slabTaxWithLines(normalIncome, cfg.slabs)
  const stcg111ATax = stcgTaxable * fy.stcg111ARate
  const ltcg112ATax = ltcgATaxable * fy.ltcgRate
  const ltcgOtherTax = ltcgOtherTaxable * fy.ltcgRate
  const cgTax = stcg111ATax + ltcg112ATax + ltcgOtherTax

  const totalIncome = normalIncome + stcg + ltcgAOverExemption + ltcgOther
  const grossTotalIncome = grossNormal + stcg + inputs.ltcg112A + ltcgOther

  // 87A rebate
  let rebate = 0
  if (totalIncome <= cfg.rebateLimit) {
    // Old regime: rebate covers everything except 112A; new regime: normal-rate tax only
    const rebateableTax = regime === "OLD" ? slabTax + stcg111ATax + ltcgOtherTax : slabTax
    rebate = Math.min(cfg.rebateCap, rebateableTax)
  } else if (cfg.rebateMarginalRelief && normalIncome > cfg.rebateLimit && cgTax === 0) {
    // New-regime marginal relief: tax payable capped at income above the limit
    const excess = totalIncome - cfg.rebateLimit
    if (slabTax > excess) rebate = slabTax - excess
  }

  const taxAfterRebate = clampPos(slabTax + cgTax - rebate)
  const surcharge = computeSurcharge({
    totalIncome,
    taxAfterRebate,
    cgTax,
    bands: cfg.surchargeBands,
    slabsForRelief: cfg.slabs,
    normalIncome,
  })
  const taxBeforeCess = taxAfterRebate + surcharge
  const cess = taxBeforeCess * 0.04
  const totalTax = r0(taxBeforeCess + cess)

  return {
    regime,
    grossTotalIncome: r0(grossTotalIncome),
    standardDeduction,
    chapterVIA: r0(chapterVIA),
    normalIncome: r0(normalIncome),
    totalIncome: r0(totalIncome),
    basicExemption,
    slabTax: r0(slabTax),
    stcg111ATax: r0(stcg111ATax),
    ltcg112ATax: r0(ltcg112ATax),
    ltcgOtherTax: r0(ltcgOtherTax),
    rebate87A: r0(rebate),
    surcharge: r0(surcharge),
    taxBeforeCess: r0(taxBeforeCess),
    cess: r0(cess),
    totalTax,
    slabLines: lines,
  }
}

// ─── Interest (234A/B/C) ─────────────────────────────────────────────────────

/**
 * Interest months per sec 234: any part of a month counts as a full month.
 * Counted as month-steps from `from` until reaching/passing `to`
 * (Apr 1 → Jul 20 = 4; Jul 31 → Aug 5 = 1).
 */
function interestMonths(from: Date, to: Date): number {
  if (to <= from) return 0
  let count = 0
  const cursor = new Date(from)
  while (cursor < to && count < 240) {
    cursor.setMonth(cursor.getMonth() + 1)
    count++
  }
  return count
}

export function computeInterest(opts: {
  fy: FinancialYearKey
  totalTax: number
  tds: number
  advanceTax: { q1: number; q2: number; q3: number; q4: number }
  filingDate?: Date
}): InterestResult {
  const fy = FY_CONFIGS[opts.fy]
  const { totalTax, tds, advanceTax } = opts
  const filingDate = opts.filingDate ?? new Date()

  // 234C — instalment deferment on (liability − TDS), with safe harbours
  const netForAdvance = clampPos(totalTax - tds)
  let i234C = 0
  if (netForAdvance >= 10_000) {
    const paidCum = [
      advanceTax.q1,
      advanceTax.q1 + advanceTax.q2,
      advanceTax.q1 + advanceTax.q2 + advanceTax.q3,
      advanceTax.q1 + advanceTax.q2 + advanceTax.q3 + advanceTax.q4,
    ]
    const schedule = [
      { pct: 0.15, safeHarbour: 0.12, months: 3 },
      { pct: 0.45, safeHarbour: 0.36, months: 3 },
      { pct: 0.75, safeHarbour: 0.75, months: 3 },
      { pct: 1.0, safeHarbour: 1.0, months: 1 },
    ]
    schedule.forEach((s, i) => {
      if (paidCum[i] >= netForAdvance * s.safeHarbour) return
      const shortfall = clampPos(netForAdvance * s.pct - paidCum[i])
      i234C += shortfall * 0.01 * s.months
    })
  }

  // 234B — total prepaid < 90% of liability → 1%/month from 1 Apr of AY
  const prepaid = tds + advanceTax.q1 + advanceTax.q2 + advanceTax.q3 + advanceTax.q4
  let i234B = 0
  const ayStartYear = Number(opts.fy.slice(0, 4)) + 1
  const aprilFirst = new Date(ayStartYear, 3, 1)
  if (netForAdvance >= 10_000 && prepaid < 0.9 * totalTax) {
    const months = interestMonths(aprilFirst, filingDate)
    i234B = clampPos(totalTax - prepaid) * 0.01 * months
  }

  // 234A — filing after the due date → 1%/month on the unpaid balance
  let i234A = 0
  if (filingDate > fy.dueDate) {
    const months = interestMonths(fy.dueDate, filingDate)
    i234A = clampPos(totalTax - prepaid) * 0.01 * months
  }

  return { i234A: r0(i234A), i234B: r0(i234B), i234C: r0(i234C), total: r0(i234A + i234B + i234C) }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function computeItr(inputs: ItrInputs): ItrComparison {
  const oldR = computeRegime(inputs, "OLD")
  const newR = computeRegime(inputs, "NEW")
  const recommended = newR.totalTax <= oldR.totalTax ? "NEW" : "OLD"
  const winner = recommended === "NEW" ? newR : oldR

  const interest = computeInterest({
    fy: inputs.fy,
    totalTax: winner.totalTax,
    tds: inputs.tds,
    advanceTax: inputs.advanceTax,
    filingDate: inputs.filingDate,
  })

  const totalPrepaid =
    inputs.tds + inputs.advanceTax.q1 + inputs.advanceTax.q2 + inputs.advanceTax.q3 + inputs.advanceTax.q4

  return {
    old: oldR,
    new: newR,
    recommended,
    savings: Math.abs(oldR.totalTax - newR.totalTax),
    interest,
    totalPrepaid: r0(totalPrepaid),
    netPayable: r0(winner.totalTax + interest.total - totalPrepaid),
  }
}
