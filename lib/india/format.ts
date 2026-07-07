/**
 * India-first number, currency, and financial-year formatting.
 *
 * Single source of truth for every ₹ amount the app renders — dashboards,
 * invoices, PDFs, reports. Indian digit grouping (1,23,45,678), compact
 * lakh/crore display for KPIs, and statutory amount-in-words for invoices.
 */

// ─── Currency ────────────────────────────────────────────────────────────────

const INR_WHOLE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const INR_PAISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const IN_NUMBER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 })

const IN_NUMBER_PAISE = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format an amount in rupees with Indian digit grouping.
 * Whole rupees by default; pass `{ paise: true }` to always show 2 decimals.
 * Invalid/absent input renders as ₹0 so UI never shows "NaN".
 */
export function formatINR(
  amount: number | string | null | undefined,
  opts: { paise?: boolean } = {}
): string {
  const n = typeof amount === "string" ? Number(amount) : amount ?? 0
  const safe = Number.isFinite(n as number) ? (n as number) : 0
  return opts.paise ? INR_PAISE.format(safe) : INR_WHOLE.format(safe)
}

/**
 * Indian digit grouping without the currency symbol (tables, inputs, PDFs
 * that prefix "Rs." because their font lacks the ₹ glyph).
 * `{ paise: true }` forces exactly 2 decimals.
 */
export function formatIndianNumber(
  amount: number | null | undefined,
  opts: { paise?: boolean } = {}
): string {
  const safe = Number.isFinite(amount as number) ? (amount as number) : 0
  return opts.paise ? IN_NUMBER_PAISE.format(safe) : IN_NUMBER.format(safe)
}

/**
 * Compact KPI display: ₹1.24 Cr · ₹45.6 L · ₹12,500.
 * Keeps at most 2 decimals and trims trailing zeros (₹1.5 Cr, not ₹1.50 Cr).
 */
export function formatINRCompact(amount: number | null | undefined): string {
  const n = Number.isFinite(amount as number) ? (amount as number) : 0
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  const trim = (v: number) =>
    v.toFixed(2).replace(/\.?0+$/, "")

  if (abs >= 1_00_00_000) return `${sign}₹${trim(abs / 1_00_00_000)} Cr`
  if (abs >= 1_00_000) return `${sign}₹${trim(abs / 1_00_000)} L`
  return `${sign}${INR_WHOLE.format(abs)}`
}

// ─── Amount in words (Indian system) ─────────────────────────────────────────

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
]
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
]

/** Words for 0–99. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t]
}

/** Words for 0–999. */
function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h) parts.push(`${ONES[h]} Hundred`)
  if (rest) parts.push(twoDigits(rest))
  return parts.join(" ")
}

/**
 * Integer → words in the Indian system (thousand, lakh, crore), recursing
 * above crores so arbitrarily large amounts read naturally
 * ("One Lakh Twenty Thousand Crore …").
 */
function integerInWords(n: number): string {
  if (n === 0) return "Zero"
  const crore = Math.floor(n / 1_00_00_000)
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000)
  const thousand = Math.floor((n % 1_00_000) / 1_000)
  const rest = n % 1_000
  const parts: string[] = []
  if (crore) parts.push(`${integerInWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rest) parts.push(threeDigits(rest))
  return parts.join(" ")
}

/**
 * Statutory invoice amount-in-words:
 *   1234567.5 → "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred
 *                Sixty-Seven and Paise Fifty Only"
 * Negative amounts are prefixed "Minus" (credit notes).
 */
export function amountInWords(amount: number | null | undefined): string {
  const n = Number.isFinite(amount as number) ? (amount as number) : 0
  const sign = n < 0 ? "Minus " : ""
  const abs = Math.abs(n)
  const rupees = Math.floor(abs)
  // Round paise to 2dp, carrying 99.999 → 100.00 correctly
  const paise = Math.round((abs - rupees) * 100)
  const carriedRupees = paise === 100 ? rupees + 1 : rupees
  const finalPaise = paise === 100 ? 0 : paise

  const rupeeWords = `Rupees ${integerInWords(carriedRupees)}`
  const paiseWords = finalPaise ? ` and Paise ${twoDigits(finalPaise)}` : ""
  return `${sign}${rupeeWords}${paiseWords} Only`
}

// ─── Financial year / assessment year ────────────────────────────────────────

export type FinancialYear = {
  /** e.g. 2026 — the year the FY starts in (Apr 1) */
  startYear: number
  /** "2026-27" */
  short: string
  /** "FY 2026-27" */
  label: string
  /** "2027-28" — the assessment year for this FY */
  assessmentYear: string
  start: Date
  end: Date
}

function buildFY(startYear: number): FinancialYear {
  const endShort = String((startYear + 1) % 100).padStart(2, "0")
  const ayEndShort = String((startYear + 2) % 100).padStart(2, "0")
  return {
    startYear,
    short: `${startYear}-${endShort}`,
    label: `FY ${startYear}-${endShort}`,
    assessmentYear: `${startYear + 1}-${ayEndShort}`,
    start: new Date(startYear, 3, 1), // Apr 1
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999), // Mar 31
  }
}

/** The Indian financial year (Apr–Mar) containing the given date. */
export function financialYearOf(date: Date = new Date()): FinancialYear {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
  return buildFY(startYear)
}

/** Parse "2026-27" / "FY 2026-27" / "2026" into a FinancialYear. */
export function parseFinancialYear(input: string): FinancialYear | null {
  const m = input.trim().match(/^(?:FY\s*)?(\d{4})(?:\s*-\s*(\d{2,4}))?$/i)
  if (!m) return null
  const startYear = Number(m[1])
  if (startYear < 1950 || startYear > 2100) return null
  if (m[2]) {
    const endGiven = Number(m[2].length === 2 ? `${String(startYear + 1).slice(0, 2)}${m[2]}` : m[2])
    if (endGiven !== startYear + 1) return null
  }
  return buildFY(startYear)
}

/** List recent FYs for dropdowns, newest first. */
export function recentFinancialYears(count = 5, from: Date = new Date()): FinancialYear[] {
  const current = financialYearOf(from)
  return Array.from({ length: count }, (_, i) => buildFY(current.startYear - i))
}
