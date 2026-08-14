"use server"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { tdsQuarter } from "@/lib/billing/tds"
import { parseFinancialYear } from "@/lib/india/format"

/**
 * TDS deducted from the firm's own fees, laid out the way 26AS is.
 *
 * Every Indian firm reconciles what its clients say they deducted against what
 * Form 26AS shows the department received. A mismatch means a client withheld
 * the tax and did not deposit it, or deposited it against the wrong PAN — and
 * the firm cannot claim the credit until it is found. That reconciliation ran
 * off a spreadsheet because the app had nowhere to hold the deductions.
 *
 * Grouped by deductor and TDS quarter, because those are the two axes 26AS
 * uses. TDS quarters run April–June through January–March, so grouping by
 * calendar quarter would misplace every deduction made in the last quarter of
 * the financial year.
 */

export type TdsCreditRow = {
  clientId: string
  clientName: string
  /** The deductor's TAN would go here; PAN is what the firm holds today. */
  clientPan: string | null
  quarter: string
  section: string
  tdsAmount: number
  /** Gross fees the deduction was made against, for the rate sanity-check. */
  grossBilled: number
  receipts: number
}

export type TdsCreditSummary = {
  financialYear: string
  rows: TdsCreditRow[]
  totalTds: number
  /** Deductions where the implied rate is not one a standard section produces. */
  anomalies: string[]
}

export async function getTdsCredits(financialYear?: string): Promise<TdsCreditSummary> {
  await requirePartnerOrManager()

  const fy =
    (financialYear ? parseFinancialYear(financialYear) : null) ??
    parseFinancialYear(String(new Date().getFullYear()))!

  const receipts = await prisma.paymentReceipt.findMany({
    where: {
      tdsAmount: { not: null },
      paymentDate: { gte: fy.start, lte: fy.end },
      // PaymentReceipt carries no firmId — it reaches the firm through the
      // invoice. Nested, not spread, so the condition cannot be replaced.
      invoice: { deletedAt: null },
    },
    select: {
      amount: true,
      tdsAmount: true,
      tdsSection: true,
      paymentDate: true,
      invoice: {
        select: {
          professionalFee: true,
          amount: true,
          client: { select: { id: true, name: true, pan: true } },
        },
      },
    },
  })

  // Key on deductor + quarter + section: that is one line of a 26AS statement.
  const byKey = new Map<string, TdsCreditRow>()
  let totalTds = 0

  for (const r of receipts) {
    const client = r.invoice?.client
    if (!client) continue

    const q = tdsQuarter(r.paymentDate)
    const section = r.tdsSection ?? "194J"
    const key = `${client.id}|${q.label}|${section}`
    const tds = Number(r.tdsAmount ?? 0)
    totalTds += tds

    const existing = byKey.get(key)
    if (existing) {
      existing.tdsAmount += tds
      existing.grossBilled += Number(r.invoice?.professionalFee ?? 0)
      existing.receipts += 1
    } else {
      byKey.set(key, {
        clientId: client.id,
        clientName: client.name,
        clientPan: client.pan,
        quarter: q.label,
        section,
        tdsAmount: tds,
        grossBilled: Number(r.invoice?.professionalFee ?? 0),
        receipts: 1,
      })
    }
  }

  const rows = [...byKey.values()].sort(
    (a, b) => a.quarter.localeCompare(b.quarter) || a.clientName.localeCompare(b.clientName)
  )

  // A deduction that is not close to a standard rate is usually a typo or a
  // lower-deduction certificate. Worth flagging before it is claimed, not after
  // the department queries it.
  const anomalies: string[] = []
  for (const row of rows) {
    if (row.grossBilled <= 0) continue
    const impliedRate = (row.tdsAmount / row.grossBilled) * 100
    const expected = row.section === "194C" ? 2 : row.section === "194H" ? 5 : 10
    if (Math.abs(impliedRate - expected) > 0.6) {
      anomalies.push(
        `${row.clientName} (${row.quarter}): ${impliedRate.toFixed(1)}% deducted under ${row.section}, where ${expected}% is standard.`
      )
    }
  }

  return {
    financialYear: fy.short,
    rows,
    totalTds: Math.round(totalTds * 100) / 100,
    anomalies,
  }
}
