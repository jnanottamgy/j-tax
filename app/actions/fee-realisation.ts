"use server"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { serviceLabel } from "@/lib/clients/constants"
import { parseFinancialYear } from "@/lib/india/format"
import {
  computeRealisation,
  totalRealisation,
  type RealisationRow,
  type RealisationTotals,
} from "@/lib/billing/realisation"

/**
 * Quoted against invoiced against collected, per client and per service.
 *
 * All three numbers existed and none could be put beside the others: the agreed
 * fee on the engagement, the billed fee on invoices, the received amount on
 * receipts. So the two questions that decide whether a practice makes money —
 * are we billing what we agreed, and collecting what we billed — had no answer
 * short of a spreadsheet.
 */

export type RealisationScope = "client" | "service"

export type FeeRealisationReport = {
  financialYear: string
  scope: RealisationScope
  rows: RealisationRow[]
  totals: RealisationTotals
}

export async function getFeeRealisation(opts?: {
  financialYear?: string
  scope?: RealisationScope
}): Promise<FeeRealisationReport> {
  await requirePartnerOrManager()

  const scope = opts?.scope ?? "client"
  const fy =
    (opts?.financialYear ? parseFinancialYear(opts.financialYear) : null) ??
    parseFinancialYear(String(new Date().getFullYear()))!

  const [invoices, engagements] = await Promise.all([
    prisma.invoice.findMany({
      where: { deletedAt: null, issueDate: { gte: fy.start, lte: fy.end } },
      select: {
        status: true,
        serviceType: true,
        professionalFee: true,
        amount: true,
        client: { select: { id: true, name: true } },
        // Collected has to come from receipts, not paidAmount: paidAmount is a
        // running total that includes payments made in a later year, and the
        // question here is what this year's fees brought in.
        payments: { select: { amount: true, tdsAmount: true } },
      },
    }),
    prisma.clientService.findMany({
      where: { isActive: true, client: { deletedAt: null, status: "ACTIVE" } },
      select: {
        serviceType: true,
        customName: true,
        agreedFee: true,
        frequency: true,
        billingFrequency: true,
        client: { select: { id: true, name: true } },
      },
    }),
  ])

  // How many times a year each engagement is billed, so an agreed fee per
  // occurrence becomes a comparable annual figure. Comparing a monthly fee
  // against a year of invoices would show every retainer as 1200% billed.
  const occurrences = (freq: string): number =>
    freq === "MONTHLY" ? 12 : freq === "QUARTERLY" ? 4 : freq === "ANNUAL" ? 1 : 0

  type Bucket = { label: string; quoted: number | null; invoiced: number; collected: number; writtenOff: number }
  const buckets = new Map<string, Bucket>()

  const keyFor = (clientId: string, clientName: string, service: string | null, label: string) =>
    scope === "client"
      ? { key: clientId, label: clientName }
      : { key: service ?? "OTHER", label }

  for (const e of engagements) {
    const perYear = occurrences(e.billingFrequency ?? e.frequency)
    const annual = e.agreedFee != null && perYear > 0 ? Number(e.agreedFee) * perYear : null
    if (annual == null) continue

    const { key, label } = keyFor(
      e.client.id,
      e.client.name,
      e.serviceType,
      serviceLabel(e.serviceType, e.customName)
    )
    const b = buckets.get(key) ?? { label, quoted: 0, invoiced: 0, collected: 0, writtenOff: 0 }
    b.quoted = (b.quoted ?? 0) + annual
    buckets.set(key, b)
  }

  for (const inv of invoices) {
    if (!inv.client) continue
    const fee = Number(inv.professionalFee ?? 0)
    const { key, label } = keyFor(
      inv.client.id,
      inv.client.name,
      inv.serviceType,
      inv.serviceType ? serviceLabel(inv.serviceType) : "Other"
    )
    const b = buckets.get(key) ?? { label, quoted: null, invoiced: 0, collected: 0, writtenOff: 0 }

    if (inv.status === "WAIVED") {
      b.writtenOff += fee
    } else {
      b.invoiced += fee
      // TDS counts as collected: the client deducted it and remitted it
      // against the firm's PAN. Leaving it out would understate realisation by
      // ten percent for every company client.
      const received = inv.payments.reduce(
        (s, p) => s + Number(p.amount) + Number(p.tdsAmount ?? 0),
        0
      )
      // Receipts are gross of GST and this report compares fees, so take the
      // fee's share of the invoice rather than assuming a rate — legacy
      // invoices carry no tax at all, and 0% and 18% are both real here.
      const invoiceTotal = Number(inv.amount)
      b.collected += invoiceTotal > 0 ? received * (fee / invoiceTotal) : received
    }
    buckets.set(key, b)
  }

  const rows = [...buckets.entries()]
    .map(([key, b]) =>
      computeRealisation({
        key,
        label: b.label,
        quoted: b.quoted,
        invoiced: Math.round(b.invoiced * 100) / 100,
        collected: Math.round(b.collected * 100) / 100,
        writtenOff: Math.round(b.writtenOff * 100) / 100,
      })
    )
    .filter((r) => r.quoted || r.invoiced > 0)
    .sort((a, b) => b.invoiced - a.invoiced)

  return {
    financialYear: fy.short,
    scope,
    rows,
    totals: totalRealisation(rows),
  }
}
