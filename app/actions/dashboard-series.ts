"use server"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"

export type Granularity = "daily" | "monthly" | "yearly"
export type RevenuePoint = { label: string; billed: number; collected: number }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * Time-series of billed vs collected revenue within an Indian FY (Apr–Mar),
 * bucketed by the chosen granularity. Built from the tenant-scoped Invoice
 * model only (firmId + deletedAt auto-applied) — PaymentReceipt is not tenant
 * scoped, so we use invoice.paidAmount for "collected" to stay firm-safe.
 */
export async function getRevenueSeries(
  startYear: number,
  granularity: Granularity
): Promise<RevenuePoint[]> {
  await requirePartnerOrManager()

  const start = new Date(startYear, 3, 1) // Apr 1
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59, 999) // Mar 31

  const invoices = await prisma.invoice.findMany({
    where: { issueDate: { gte: start, lte: end } },
    select: { issueDate: true, amount: true, paidAmount: true },
  })

  if (granularity === "yearly") {
    let billed = 0
    let collected = 0
    for (const inv of invoices) {
      billed += Number(inv.amount)
      collected += Number(inv.paidAmount)
    }
    return [{ label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`, billed, collected }]
  }

  if (granularity === "monthly") {
    // 12 buckets, financial-year order Apr → Mar.
    const buckets: RevenuePoint[] = Array.from({ length: 12 }, (_, i) => {
      const monthIdx = (3 + i) % 12
      return { label: MONTHS[monthIdx], billed: 0, collected: 0 }
    })
    for (const inv of invoices) {
      const d = new Date(inv.issueDate)
      const fyIndex = (d.getMonth() - 3 + 12) % 12
      buckets[fyIndex].billed += Number(inv.amount)
      buckets[fyIndex].collected += Number(inv.paidAmount)
    }
    return buckets
  }

  // daily — only buckets that have activity, chronological.
  const byDay = new Map<string, RevenuePoint & { sort: number }>()
  for (const inv of invoices) {
    const d = new Date(inv.issueDate)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const label = `${d.getDate()} ${MONTHS[d.getMonth()]}`
    const existing = byDay.get(key) ?? { label, billed: 0, collected: 0, sort: d.getTime() }
    existing.billed += Number(inv.amount)
    existing.collected += Number(inv.paidAmount)
    byDay.set(key, existing)
  }
  return [...byDay.values()]
    .sort((a, b) => a.sort - b.sort)
    .map(({ label, billed, collected }) => ({ label, billed, collected }))
}
