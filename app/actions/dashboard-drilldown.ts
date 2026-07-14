"use server"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"

export type AmountMetric = "revenue" | "outstanding" | "overdue" | "collected"

export type ClientAmountRow = {
  clientId: string
  name: string
  code: string
  amount: number
}

/**
 * Per-client breakdown behind a dashboard money tile. Runs through the
 * tenant-scoped Prisma client (firmId + deletedAt auto-applied), guarded to
 * PARTNER/MANAGER. Sorted highest-first.
 */
export async function getClientAmountBreakdown(
  metric: AmountMetric
): Promise<ClientAmountRow[]> {
  await requirePartnerOrManager()

  const sumField =
    metric === "revenue"
      ? "amount"
      : metric === "collected"
        ? "paidAmount"
        : "outstandingAmount"

  const where: Record<string, unknown> = {}
  if (metric === "overdue") where.status = "OVERDUE"
  if (metric === "outstanding") where.outstandingAmount = { gt: 0 }

  const grouped = await prisma.invoice.groupBy({
    by: ["clientId"],
    where,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _sum: { [sumField]: true } as any,
  })

  const rows = grouped
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((g) => ({ clientId: g.clientId, amount: Number((g._sum as any)[sumField] ?? 0) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  if (rows.length === 0) return []

  const clients = await prisma.client.findMany({
    where: { id: { in: rows.map((r) => r.clientId) } },
    select: { id: true, name: true, clientCode: true },
  })
  const byId = new Map(clients.map((c) => [c.id, c]))

  return rows.map((r) => ({
    clientId: r.clientId,
    name: byId.get(r.clientId)?.name ?? "Unknown client",
    code: byId.get(r.clientId)?.clientCode ?? "",
    amount: r.amount,
  }))
}
