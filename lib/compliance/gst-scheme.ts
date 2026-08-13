/**
 * GST filing cadence, derived from what the client actually is.
 *
 * The filing frequency on a client's services was picked by hand from a
 * dropdown with nothing behind it. In practice the choice is not free: a
 * registered person with aggregate turnover up to ₹5 crore may opt into QRMP
 * (quarterly returns with monthly tax payment), and above that must file
 * monthly. Recording turnover lets the calendar be right by default and lets
 * the app say *why* it chose what it chose.
 *
 * Everything here is offline arithmetic against published thresholds. The
 * client's explicit choice always wins — a small client can stay on monthly
 * filing, and plenty do.
 */

/** Aggregate turnover ceiling for QRMP eligibility: ₹5 crore. */
export const QRMP_TURNOVER_LIMIT = 50_000_000

/**
 * s.44AB tax-audit thresholds.
 *
 * The business limit is ₹1 crore, raised to ₹10 crore when both cash receipts
 * and cash payments are 5% or less of the total. We cannot know the cash ratio,
 * so the higher figure is reported as a "check" band rather than an assertion.
 */
export const TAX_AUDIT_BUSINESS_LIMIT = 10_000_000
export const TAX_AUDIT_BUSINESS_LIMIT_LOW_CASH = 100_000_000
export const TAX_AUDIT_PROFESSION_LIMIT = 7_500_000

export type GstScheme = "MONTHLY" | "QRMP"

export type GstSchemeResolution = {
  scheme: GstScheme
  /** Where the answer came from, so the UI can explain itself. */
  source: "explicit" | "turnover" | "default"
  reason: string
}

/**
 * Which cadence applies. Order matters: an explicit setting is a decision the
 * firm made and must never be silently overridden by a turnover figure that
 * happens to be stale.
 */
export function resolveGstScheme(input: {
  /** The client's stored override, if any. */
  explicit?: string | null
  /** Aggregate annual turnover in rupees. */
  annualTurnover?: number | null
}): GstSchemeResolution {
  const explicit = input.explicit?.trim().toUpperCase()
  if (explicit === "QRMP" || explicit === "MONTHLY") {
    return {
      scheme: explicit,
      source: "explicit",
      reason: "Set on the client record.",
    }
  }

  const turnover = input.annualTurnover
  if (turnover != null && Number.isFinite(turnover) && turnover > 0) {
    if (turnover > QRMP_TURNOVER_LIMIT) {
      return {
        scheme: "MONTHLY",
        source: "turnover",
        reason: `Turnover above ₹5 crore — monthly filing is mandatory.`,
      }
    }
    return {
      scheme: "QRMP",
      source: "turnover",
      reason: "Turnover up to ₹5 crore — eligible for quarterly filing (QRMP).",
    }
  }

  // No turnover recorded. Monthly is the safe default: it over-files rather
  // than missing a return, and a missed GSTR-3B carries interest and late fees.
  return {
    scheme: "MONTHLY",
    source: "default",
    reason: "No turnover recorded — defaulting to monthly filing.",
  }
}

/**
 * QRMP GSTR-3B due date depends on the taxpayer's principal place of business.
 * Category X states get the 22nd; the rest get the 24th.
 */
const QRMP_22ND_STATE_CODES = new Set([
  "22", // Chhattisgarh
  "23", // Madhya Pradesh
  "24", // Gujarat
  "25", // Daman & Diu (legacy)
  "26", // Dadra & Nagar Haveli and Daman & Diu
  "27", // Maharashtra
  "29", // Karnataka
  "30", // Goa
  "31", // Lakshadweep
  "32", // Kerala
  "33", // Tamil Nadu
  "34", // Puducherry
  "35", // Andaman & Nicobar Islands
  "36", // Telangana
  "37", // Andhra Pradesh
  "28", // Andhra Pradesh (old)
])

/** Day of the month a QRMP GSTR-3B falls due, by GST state code. */
export function qrmpGstr3bDueDay(stateCode: string | null | undefined): 22 | 24 {
  const code = (stateCode ?? "").trim()
  return QRMP_22ND_STATE_CODES.has(code) ? 22 : 24
}

export type TaxAuditIndication = {
  /** true when turnover is past the point where s.44AB clearly bites. */
  likely: boolean
  /** true in the band where it depends on the cash-transaction ratio. */
  checkCashRatio: boolean
  reason: string
}

/**
 * Does a s.44AB tax audit look likely at this turnover?
 *
 * Reported as an indication, never as a determination: the ₹1 crore limit lifts
 * to ₹10 crore where cash receipts and payments are each 5% or less of the
 * total, and the app has no way to know that ratio.
 */
export function indicateTaxAudit(input: {
  annualTurnover?: number | null
  /** Professionals have their own, lower limit. */
  isProfession?: boolean
}): TaxAuditIndication {
  const turnover = input.annualTurnover
  if (turnover == null || !Number.isFinite(turnover) || turnover <= 0) {
    return { likely: false, checkCashRatio: false, reason: "No turnover recorded." }
  }

  if (input.isProfession) {
    return turnover > TAX_AUDIT_PROFESSION_LIMIT
      ? {
          likely: true,
          checkCashRatio: false,
          reason: "Gross receipts above ₹75 lakh — s.44AB audit applies to a profession.",
        }
      : { likely: false, checkCashRatio: false, reason: "Below the ₹75 lakh limit for a profession." }
  }

  if (turnover > TAX_AUDIT_BUSINESS_LIMIT_LOW_CASH) {
    return {
      likely: true,
      checkCashRatio: false,
      reason: "Turnover above ₹10 crore — s.44AB audit applies regardless of cash ratio.",
    }
  }
  if (turnover > TAX_AUDIT_BUSINESS_LIMIT) {
    return {
      likely: false,
      checkCashRatio: true,
      reason:
        "Turnover between ₹1 crore and ₹10 crore — audit applies unless cash receipts and payments are each 5% or less.",
    }
  }
  return { likely: false, checkCashRatio: false, reason: "Below the ₹1 crore limit." }
}

/** Month names for the accounting-year-end selector, 1-indexed. */
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

/**
 * Human label for a client's accounting year end.
 *
 * Note this is the client's *accounting* year, which is not always the Indian
 * tax year. Indian statutory deadlines run on April–March by law (s.3 of the
 * Income-tax Act) whatever the company's books do, so this drives the firm's
 * own planning — group reporting, audit scheduling — not the statutory calendar.
 */
export function fyEndLabel(month: number | null | undefined): string {
  const m = month ?? 3
  const idx = Math.min(Math.max(Math.trunc(m), 1), 12) - 1
  const lastDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][idx]
  return `${lastDay} ${MONTH_NAMES[idx]}`
}
