/**
 * Fee realisation: quoted → invoiced → collected.
 *
 * Three numbers the firm already had and could never put side by side. The
 * agreed fee lived on the engagement, what was billed lived on invoices, and
 * what came in lived on receipts — so nobody could answer the two questions
 * that decide whether a practice is actually profitable:
 *
 *   - Are we billing what we agreed? (leakage — work done and never invoiced)
 *   - Are we collecting what we billed? (realisation — invoiced and never paid)
 *
 * A firm can be busy, fully booked and quietly losing money on both at once,
 * and the first sign is usually a cash crunch rather than a report.
 *
 * Collected counts TDS. The client deducted it and remitted it against the
 * firm's PAN; it is money earned and received, just received by the government
 * first. Excluding it would understate realisation by ten percent for every
 * company client and make a well-run firm look like it could not collect.
 *
 * Pure arithmetic — the caller does the queries.
 */

export type RealisationInput = {
  key: string
  label: string
  /** Fee agreed for the period, excluding GST. Null where none was agreed. */
  quoted: number | null
  /** Professional fees invoiced, excluding GST. */
  invoiced: number
  /** Cash received plus TDS deducted, against those invoices. */
  collected: number
  /** Invoiced but written off — never going to be collected. */
  writtenOff: number
}

export type RealisationRow = RealisationInput & {
  /** invoiced ÷ quoted. Null when nothing was agreed to compare against. */
  billingRate: number | null
  /** collected ÷ invoiced. Null when nothing was invoiced. */
  collectionRate: number | null
  /** collected ÷ quoted — the number that actually matters. */
  realisationRate: number | null
  /** Agreed but never billed. Positive means fees left on the table. */
  leakage: number | null
  /** Billed and not yet collected, excluding what was written off. */
  outstanding: number
}

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 1000) / 10 : null

export function computeRealisation(input: RealisationInput): RealisationRow {
  const { quoted, invoiced, collected, writtenOff } = input

  return {
    ...input,
    billingRate: quoted != null ? pct(invoiced, quoted) : null,
    collectionRate: pct(collected, invoiced),
    realisationRate: quoted != null ? pct(collected, quoted) : null,
    // Only a shortfall counts as leakage. Billing above the agreed fee is
    // normal — extra scope, a revised engagement — and reporting it as
    // negative leakage would invite someone to "correct" it.
    leakage: quoted != null ? Math.max(0, Math.round((quoted - invoiced) * 100) / 100) : null,
    outstanding: Math.max(0, Math.round((invoiced - collected - writtenOff) * 100) / 100),
  }
}

export type RealisationTotals = {
  quoted: number
  invoiced: number
  collected: number
  writtenOff: number
  outstanding: number
  billingRate: number | null
  collectionRate: number | null
  realisationRate: number | null
  /** Rows with an agreed fee that has been under-billed. */
  leakingCount: number
  totalLeakage: number
}

/**
 * Firm-wide totals.
 *
 * Rates are computed from the summed amounts, not averaged across rows — a
 * mean of percentages lets one ₹5,000 client swing the number as hard as a
 * ₹5,00,000 one, which is how a firm talks itself into believing collection is
 * fine.
 */
export function totalRealisation(rows: RealisationRow[]): RealisationTotals {
  const sum = (pick: (r: RealisationRow) => number) =>
    Math.round(rows.reduce((s, r) => s + pick(r), 0) * 100) / 100

  // Only rows with an agreed fee contribute to the quoted total, so the
  // billing rate is not diluted by work nobody priced.
  const quoted = sum((r) => r.quoted ?? 0)
  const invoicedAgainstQuoted = Math.round(
    rows.filter((r) => r.quoted != null).reduce((s, r) => s + r.invoiced, 0) * 100
  ) / 100
  const invoiced = sum((r) => r.invoiced)
  const collected = sum((r) => r.collected)
  const writtenOff = sum((r) => r.writtenOff)

  return {
    quoted,
    invoiced,
    collected,
    writtenOff,
    outstanding: sum((r) => r.outstanding),
    billingRate: pct(invoicedAgainstQuoted, quoted),
    collectionRate: pct(collected, invoiced),
    realisationRate: pct(collected, quoted),
    leakingCount: rows.filter((r) => (r.leakage ?? 0) > 0).length,
    totalLeakage: sum((r) => r.leakage ?? 0),
  }
}
