import type { Prisma } from "@prisma/client"

/**
 * Which invoices the nightly job is allowed to call overdue.
 *
 * The job used to select by exclusion — everything except PAID, OVERDUE,
 * DISPUTED and WAIVED — which quietly included DRAFT. A draft has never been
 * sent to anybody. Marking one overdue tells the partner a client is late
 * paying an invoice the client has never seen, and it lands in the receivables
 * ageing and the dunning list all the same.
 *
 * So this is an allowlist. An invoice can only be late if it was actually
 * issued. A status added to the schema later joins an exclusion list by
 * accident and this one only on purpose.
 */
export const OVERDUE_ELIGIBLE_STATUSES = ["SENT", "PARTIALLY_PAID"] as const

export type OverdueEligibleStatus = (typeof OVERDUE_ELIGIBLE_STATUSES)[number]

export function canBecomeOverdue(status: string): boolean {
  return (OVERDUE_ELIGIBLE_STATUSES as readonly string[]).includes(status)
}

/**
 * The `where` for the nightly sweep.
 *
 * `outstandingAmount > 0` matters on its own: an invoice settled by a credit
 * note keeps its PARTIALLY_PAID status while its balance goes to zero, and
 * without this it gets chased for nothing.
 */
export function overdueSweepFilter(now: Date): Prisma.InvoiceWhereInput {
  return {
    dueDate: { lt: now },
    status: { in: [...OVERDUE_ELIGIBLE_STATUSES] },
    outstandingAmount: { gt: 0 },
  }
}

/**
 * Whether an invoice that is currently marked OVERDUE still is.
 *
 * The flag was one-way: the cron set OVERDUE and nothing ever set it back, so
 * extending a due date left the invoice permanently late. Extending a deadline
 * is the ordinary way a practice handles "they asked for another fortnight".
 */
export function isNoLongerOverdue(invoice: {
  status: string
  dueDate: Date | null
  outstandingAmount: number
}, now: Date): boolean {
  if (invoice.status !== "OVERDUE") return false
  if (invoice.outstandingAmount <= 0) return true
  if (!invoice.dueDate) return true
  return invoice.dueDate >= now
}
