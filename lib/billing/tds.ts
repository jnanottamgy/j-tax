/**
 * TDS the client deducts from the firm's own fees.
 *
 * An Indian company paying professional fees deducts tax at source under
 * s.194J and remits it to the government against the firm's PAN. The firm
 * receives the net; the deducted part arrives later as a credit in Form 26AS,
 * and every firm reconciles the two at year end.
 *
 * The app had nowhere to record it, and that was not merely a missing feature —
 * it was wrong arithmetic. A ₹1,00,000 invoice settled by a ₹90,000 transfer
 * with ₹10,000 deducted was recorded as a ₹90,000 payment, so the invoice stayed
 * PARTIALLY_PAID with ₹10,000 outstanding for ever. The firm chased money that
 * had already been paid to the government on its behalf, the receivables report
 * was permanently overstated, and the only way to close the invoice was to
 * pretend the ₹10,000 had been received.
 *
 * Pure arithmetic and rate tables; no database.
 */

/** The sections a professional firm's own receipts are deducted under. */
export type TdsSection = "194J" | "194C" | "194H" | "194I" | "OTHER"

export const TDS_SECTIONS: Array<{
  value: TdsSection
  label: string
  /** Standard rate, as a percentage. */
  rate: number | null
}> = [
  { value: "194J", label: "194J — Professional / technical fees", rate: 10 },
  { value: "194C", label: "194C — Contract work", rate: 2 },
  { value: "194H", label: "194H — Commission or brokerage", rate: 5 },
  { value: "194I", label: "194I — Rent", rate: 10 },
  { value: "OTHER", label: "Other section", rate: null },
]

const RATE_BY_SECTION = new Map(TDS_SECTIONS.map((s) => [s.value, s.rate]))

/**
 * TDS at the standard rate for a section, rounded to the rupee.
 *
 * A suggestion, never an assertion: the deductor decides the rate, and it moves
 * with the client's own circumstances — a lower-deduction certificate under
 * s.197, or 20% where the firm's PAN is not on their record. The number the
 * client actually deducted is the number that goes on the receipt.
 */
export function suggestedTds(section: TdsSection, grossFee: number): number | null {
  const rate = RATE_BY_SECTION.get(section) ?? null
  if (rate == null || !(grossFee > 0)) return null
  return Math.round((grossFee * rate) / 100)
}

export type SettlementInput = {
  /** Invoice total including GST. */
  invoiceTotal: number
  /** Already settled before this payment — cash plus TDS. */
  alreadySettled: number
  /** Money actually received in the bank. */
  received: number
  /** Tax the client deducted and will remit against the firm's PAN. */
  tdsDeducted: number
}

export type Settlement =
  | { ok: true; settled: number; paidToDate: number; outstanding: number; fullySettled: boolean }
  | { ok: false; error: string }

/**
 * What this payment settles.
 *
 * TDS settles the invoice exactly as cash does. It is not a discount and not a
 * write-off: the money left the client, reached the government, and comes back
 * as a credit against the firm's tax liability. Treating it as unpaid is what
 * produced permanently overstated receivables.
 */
export function applySettlement(input: SettlementInput): Settlement {
  const { invoiceTotal, alreadySettled, received, tdsDeducted } = input

  if (received < 0 || tdsDeducted < 0) {
    return { ok: false, error: "Amounts cannot be negative." }
  }
  const settled = received + tdsDeducted
  if (settled <= 0) {
    return { ok: false, error: "Enter an amount received, a TDS deduction, or both." }
  }

  // Rounded to paise before comparing: floating point makes a payment that
  // exactly clears an invoice look like an overpayment by a hundredth of a
  // rupee, which would refuse the one payment most likely to be correct.
  const round2 = (n: number) => Math.round(n * 100) / 100
  const outstandingBefore = round2(invoiceTotal - alreadySettled)

  if (round2(settled) > outstandingBefore) {
    return {
      ok: false,
      error: `That settles ₹${round2(settled).toLocaleString("en-IN")} against ₹${outstandingBefore.toLocaleString("en-IN")} outstanding.`,
    }
  }

  const paidToDate = round2(alreadySettled + settled)
  const outstanding = Math.max(0, round2(invoiceTotal - paidToDate))

  return {
    ok: true,
    settled: round2(settled),
    paidToDate,
    outstanding,
    fullySettled: outstanding === 0,
  }
}

/**
 * The quarter a deduction falls in, as the TDS return numbers them.
 *
 * Indian TDS quarters run April–June (Q1) through January–March (Q4), which is
 * not the calendar quarter — reconciling against 26AS by calendar quarter would
 * misplace every deduction made between January and March.
 */
export function tdsQuarter(date: Date): { quarter: 1 | 2 | 3 | 4; financialYear: string; label: string } {
  const m = date.getMonth()
  const fyStart = m >= 3 ? date.getFullYear() : date.getFullYear() - 1
  const quarter: 1 | 2 | 3 | 4 = m >= 3 && m <= 5 ? 1 : m >= 6 && m <= 8 ? 2 : m >= 9 && m <= 11 ? 3 : 4
  const financialYear = `${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`
  return { quarter, financialYear, label: `Q${quarter} ${financialYear}` }
}
