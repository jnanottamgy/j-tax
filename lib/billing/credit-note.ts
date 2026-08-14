/**
 * Credit notes against issued invoices.
 *
 * The app had two things that look like this and are not it. A *revision*
 * supersedes an invoice with a new document — right before it goes out, wrong
 * afterwards, because it silently restates a return already filed. A *waiver*
 * writes the invoice off whole — right when a debt is abandoned, wrong for a
 * ₹5,000 reduction on a ₹50,000 bill, and it throws away the GST rather than
 * reclaiming it.
 *
 * Under s.34 of the CGST Act a registered supplier reduces an
 * already-reported invoice by issuing a credit note, which is reported in its
 * own right in GSTR-1. It carries a hard deadline: 30 November following the
 * end of the financial year the original invoice belongs to, or the date the
 * annual return is filed, whichever is earlier. After that the credit note can
 * still be issued commercially, but the tax cannot be adjusted — the firm eats
 * the GST.
 *
 * Pure: arithmetic, limits and the deadline. No database.
 */

export type CreditReasonCode =
  | "FEE_REDUCTION"
  | "SERVICE_NOT_RENDERED"
  | "DUPLICATE"
  | "ERROR"
  | "GOODWILL"

export const CREDIT_REASONS: Array<{ value: CreditReasonCode; label: string }> = [
  { value: "FEE_REDUCTION", label: "Fee reduced after the invoice went out" },
  { value: "SERVICE_NOT_RENDERED", label: "Work not carried out" },
  { value: "DUPLICATE", label: "Duplicate invoice" },
  { value: "ERROR", label: "Error in the original invoice" },
  { value: "GOODWILL", label: "Goodwill adjustment" },
]

/**
 * The last date the tax on this invoice can still be adjusted by credit note.
 *
 * 30 November of the year following the financial year of supply. Expressed
 * against the invoice's own issue date, since that is what fixes the year.
 */
export function taxAdjustmentDeadline(invoiceIssueDate: Date): Date {
  const m = invoiceIssueDate.getMonth()
  const fyStart = m >= 3 ? invoiceIssueDate.getFullYear() : invoiceIssueDate.getFullYear() - 1
  // FY ends 31 March of fyStart+1; the deadline is 30 November after that.
  return new Date(fyStart + 1, 10, 30, 23, 59, 59, 999)
}

export type CreditNoteInput = {
  /** Professional fee being credited, excluding GST. */
  fee: number
  /** The original invoice's GST rate, so the credit carries the same tax. */
  taxRate: number
  /** Fee on the original invoice, excluding GST. */
  invoiceFee: number
  /** Fees already credited against this invoice, excluding GST. */
  alreadyCredited: number
  /** Cash and TDS already settled against the invoice, including GST. */
  alreadySettled: number
  /** The invoice total including GST. */
  invoiceTotal: number
}

export type CreditNoteComputation =
  | {
      ok: true
      fee: number
      taxAmount: number
      /** Total credited, including GST — what comes off the invoice. */
      amount: number
      /** What the invoice still owes after this credit. */
      remainingOutstanding: number
      /** True when the credit clears the invoice entirely. */
      settlesInvoice: boolean
      /** Set when the client has already paid more than the reduced total. */
      refundDue: number
    }
  | { ok: false; error: string }

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeCreditNote(input: CreditNoteInput): CreditNoteComputation {
  if (!(input.fee > 0)) {
    return { ok: false, error: "Enter the amount being credited." }
  }

  const creditable = round2(input.invoiceFee - input.alreadyCredited)
  if (round2(input.fee) > creditable) {
    return {
      ok: false,
      error:
        input.alreadyCredited > 0
          ? `Only ₹${creditable.toLocaleString("en-IN")} is left to credit — ₹${input.alreadyCredited.toLocaleString("en-IN")} has already been credited against this invoice.`
          : `That is more than the ₹${creditable.toLocaleString("en-IN")} fee on the invoice.`,
    }
  }

  const taxAmount = round2((input.fee * input.taxRate) / 100)
  const amount = round2(input.fee + taxAmount)

  // The credit reduces what the invoice is for, so it reduces what is owed.
  const reducedTotal = round2(input.invoiceTotal - amount)
  const remainingOutstanding = round2(Math.max(0, reducedTotal - input.alreadySettled))

  // A client who has already paid more than the reduced total is owed money
  // back. Netting that silently to zero is how a refund goes unnoticed.
  const refundDue = round2(Math.max(0, input.alreadySettled - reducedTotal))

  return {
    ok: true,
    fee: round2(input.fee),
    taxAmount,
    amount,
    remainingOutstanding,
    settlesInvoice: remainingOutstanding === 0,
    refundDue,
  }
}

/** Whether the tax can still be adjusted, and what to say when it cannot. */
export function taxAdjustmentStatus(
  invoiceIssueDate: Date,
  now: Date
): { canAdjustTax: boolean; note: string } {
  const deadline = taxAdjustmentDeadline(invoiceIssueDate)
  if (now <= deadline) {
    return {
      canAdjustTax: true,
      note: `Report this in GSTR-1 for the month of issue. The GST on it can be adjusted until ${deadline.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.`,
    }
  }
  return {
    canAdjustTax: false,
    note: `The window for adjusting GST on this invoice closed on ${deadline.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}. The credit note is still valid commercially, but the tax cannot be reclaimed — the firm bears it.`,
  }
}
