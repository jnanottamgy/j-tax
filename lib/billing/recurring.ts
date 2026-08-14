/**
 * Retainer billing: the invoice a monthly engagement should raise on its own.
 *
 * A ClientService already *is* the engagement — this client, this service, at
 * this agreed fee, on this cycle. Everything needed to bill it has been on the
 * record since the fee columns were added, and nothing ever did. So a firm with
 * sixty monthly GST clients raised sixty invoices by hand every month, from
 * memory, and the ones that got missed were found in the receivables report
 * months later or not at all.
 *
 * Pure date arithmetic and selection, so the cycle can be tested without a
 * database and without waiting for a month to pass.
 *
 * Two decisions worth stating, because they are the ones a firm would argue
 * about:
 *
 *  - Generated invoices are DRAFT, never SENT. "Without anyone remembering"
 *    means the invoice should exist without being remembered, not that it
 *    should reach the client unread. A wrong invoice that went out
 *    automatically is far more expensive than a right one issued a day late,
 *    and a retainer month often carries an extra out-of-scope line.
 *  - Billing is not back-dated. A schedule switched on today bills from today,
 *    because generating six months of arrears on the first run is how a firm
 *    ends up sending a client six invoices by accident.
 */

export type BillingFrequency = "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME"

/** How many months one billing cycle covers. ONE_TIME never recurs. */
const CYCLE_MONTHS: Record<BillingFrequency, number | null> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUAL: 12,
  ONE_TIME: null,
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const

/**
 * Add whole months without the end-of-month drift JavaScript gives you by
 * default: `new Date(2026, 0, 31)` plus one month is 3 March, not 28 February.
 * A retainer billed on the 31st must not skip February.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDayOfTarget))
  return d
}

/**
 * When this engagement should next raise an invoice, given when it last did.
 * Null for a frequency that does not recur.
 */
export function nextBillingDate(
  frequency: BillingFrequency,
  lastBilledOn: Date
): Date | null {
  const months = CYCLE_MONTHS[frequency]
  return months === null ? null : addMonthsClamped(lastBilledOn, months)
}

/** Human label for the period an invoice covers — "Aug 2026", "Jul–Sep 2026". */
export function billingPeriodLabel(frequency: BillingFrequency, periodStart: Date): string {
  const months = CYCLE_MONTHS[frequency]
  const y = periodStart.getFullYear()
  if (months === null || months === 1) return `${MONTHS[periodStart.getMonth()]} ${y}`

  const end = addMonthsClamped(periodStart, months - 1)
  const sameYear = end.getFullYear() === y
  return sameYear
    ? `${MONTHS[periodStart.getMonth()]}–${MONTHS[end.getMonth()]} ${y}`
    : `${MONTHS[periodStart.getMonth()]} ${y} – ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
}

export type BillableEngagement = {
  id: string
  clientId: string
  serviceType: string
  /** Fee per occurrence, excluding GST. */
  agreedFee: number | null
  frequency: BillingFrequency
  autoInvoice: boolean
  /** Next date an invoice is due to be raised. Null = never scheduled. */
  nextBillingDate: Date | null
  isActive: boolean
  /** The client must be ACTIVE — a paused engagement must not keep billing. */
  clientIsActive: boolean
}

export type BillingDecision =
  | { bill: true; periodLabel: string; amount: number; nextAfter: Date }
  | { bill: false; reason: BillingSkipReason }

export type BillingSkipReason =
  | "not-enabled"
  | "inactive"
  | "client-inactive"
  | "no-fee"
  | "not-recurring"
  | "not-due"
  | "unscheduled"

/**
 * Should this engagement raise an invoice today?
 *
 * Every skip has a named reason rather than a bare false, because "why did my
 * retainer not bill this month" is the question this feature will be asked most
 * and an unexplained no-op is what makes people stop trusting automation.
 */
export function decideBilling(
  engagement: BillableEngagement,
  now: Date
): BillingDecision {
  if (!engagement.autoInvoice) return { bill: false, reason: "not-enabled" }
  if (!engagement.isActive) return { bill: false, reason: "inactive" }
  if (!engagement.clientIsActive) return { bill: false, reason: "client-inactive" }

  const months = CYCLE_MONTHS[engagement.frequency]
  if (months === null) return { bill: false, reason: "not-recurring" }

  // A retainer with no agreed fee has nothing to invoice. Guessing an amount
  // would be worse than skipping, and the skip is reported.
  if (engagement.agreedFee == null || !(engagement.agreedFee > 0)) {
    return { bill: false, reason: "no-fee" }
  }

  const due = engagement.nextBillingDate
  if (!due) return { bill: false, reason: "unscheduled" }
  if (due > now) return { bill: false, reason: "not-due" }

  return {
    bill: true,
    periodLabel: billingPeriodLabel(engagement.frequency, due),
    amount: engagement.agreedFee,
    nextAfter: addMonthsClamped(due, months),
  }
}

/**
 * Catch-up cycles between a missed due date and now.
 *
 * A schedule that has not run for three months owes three invoices, not one,
 * and silently collapsing them into a single invoice loses two months of fees.
 * Capped, because an engagement mis-dated years back should not generate a
 * hundred invoices in one night — the cap is reported rather than swallowed.
 */
export function catchUpPeriods(
  frequency: BillingFrequency,
  from: Date,
  now: Date,
  max = 12
): Date[] {
  const months = CYCLE_MONTHS[frequency]
  if (months === null) return []

  const periods: Date[] = []
  let cursor = new Date(from)
  while (cursor <= now && periods.length < max) {
    periods.push(new Date(cursor))
    cursor = addMonthsClamped(cursor, months)
  }
  return periods
}
