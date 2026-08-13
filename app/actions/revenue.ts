"use server"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { clientFirmFilter } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { parseFinancialYear, financialYearOf } from "@/lib/india/format"
import { stateName } from "@/lib/invoices/gst"

/**
 * Revenue ledger — the detail behind the dashboard's money tiles.
 *
 * The dashboard tile answers only "how much". This answers the questions a
 * partner actually asks next: from whom, for what work, when it was raised and
 * when it was paid, where it was supplied (which drives the GST split), and why
 * it stands where it does (status, remarks, revision history).
 *
 * One row per invoice, plus rollups the export turns into separate sheets.
 */

export type RevenueMetric = "revenue" | "collected" | "outstanding" | "overdue"

export type RevenueFilters = {
  /** "2026-27". Defaults to the current Indian FY. "all" disables the window. */
  fy?: string
  clientId?: string
  status?: string
  serviceType?: string
  metric?: RevenueMetric
}

export type RevenueRow = {
  invoiceId: string
  invoiceNumber: string
  // ── From whom ──────────────────────────────────────────────────────────────
  clientId: string
  clientName: string
  clientCode: string
  clientGstin: string | null
  assignedTo: string | null
  // ── What ───────────────────────────────────────────────────────────────────
  serviceDescription: string | null
  serviceType: string | null
  hsnSac: string | null
  // ── When ───────────────────────────────────────────────────────────────────
  issueDate: string
  dueDate: string
  lastPaymentDate: string | null
  daysOverdue: number
  // ── Where ──────────────────────────────────────────────────────────────────
  placeOfSupply: string | null
  placeOfSupplyName: string | null
  // ── How much ───────────────────────────────────────────────────────────────
  professionalFee: number | null
  taxRate: number | null
  taxAmount: number | null
  cgstAmount: number | null
  sgstAmount: number | null
  igstAmount: number | null
  amount: number
  paidAmount: number
  outstandingAmount: number
  // ── Why / provenance ───────────────────────────────────────────────────────
  status: string
  remarks: string | null
  revisionNumber: number
  revisedFromNumber: string | null
  paymentMethods: string | null
  paymentReferences: string | null
}

export type RevenueRollup = { key: string; label: string; amount: number; count: number }

export type RevenueLedger = {
  rows: RevenueRow[]
  summary: {
    invoiced: number
    professionalFees: number
    tax: number
    collected: number
    outstanding: number
    overdue: number
    invoiceCount: number
    clientCount: number
    /**
     * Annualised value of every active engagement, from the fees agreed on the
     * clients' accepted quotations. This is what the firm is contracted to
     * earn, as opposed to what it has actually invoiced — the two diverging is
     * the earliest sign of an engagement running unbilled.
     */
    contractedAnnual: number
    /** Active engagements with no agreed fee — unmeasurable, so flagged. */
    engagementsWithoutFee: number
  }
  byClient: RevenueRollup[]
  byService: RevenueRollup[]
  byMonth: RevenueRollup[]
  /** Echoed back so the UI and export agree on what was applied. */
  applied: { fy: string; label: string; from: string | null; to: string | null }
  clients: { id: string; name: string }[]
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" })

/**
 * Billing occurrences in a year, for annualising an engagement fee.
 * ONE_TIME counts once — it is real revenue in the year it is contracted, and
 * excluding it would understate what the firm has actually committed to.
 */
const OCCURRENCES_PER_YEAR: Record<string, number> = {
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
  ONE_TIME: 1,
}

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v)
}

function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v)
}

/**
 * Build the invoice `where` for the requested slice.
 *
 * The metric narrows which invoices count, matching the dashboard tile the
 * user clicked so the page never disagrees with the number they came from.
 */
function buildWhere(filters: RevenueFilters, from: Date | null, to: Date | null) {
  const where: Record<string, unknown> = {}

  if (from && to) where.issueDate = { gte: from, lte: to }
  if (filters.clientId) where.clientId = filters.clientId
  if (filters.status) where.status = filters.status
  if (filters.serviceType) where.serviceType = filters.serviceType

  switch (filters.metric) {
    case "overdue":
      where.status = filters.status || "OVERDUE"
      break
    case "outstanding":
      where.outstandingAmount = { gt: 0 }
      break
    case "collected":
      where.paidAmount = { gt: 0 }
      break
    default:
      break
  }

  return where
}

export async function getRevenueLedger(
  filters: RevenueFilters = {}
): Promise<RevenueLedger> {
  const session = await requirePartnerOrManager()

  // Default to the current Indian FY — a full-history default would be a slow
  // query and is almost never what a partner means by "revenue".
  const wantsAll = filters.fy === "all"
  const fy = wantsAll
    ? null
    : (filters.fy ? parseFinancialYear(filters.fy) : null) ?? financialYearOf()

  const from = fy?.start ?? null
  const to = fy?.end ?? null

  const invoices = await prisma.invoice.findMany({
    where: buildWhere(filters, from, to),
    include: {
      client: {
        select: {
          id: true,
          name: true,
          clientCode: true,
          gstin: true,
          assignedEmployeeName: true,
        },
      },
      payments: { orderBy: { paymentDate: "desc" } },
      revisedFrom: { select: { invoiceNumber: true } },
    },
    orderBy: { issueDate: "desc" },
  })

  const now = Date.now()

  const rows: RevenueRow[] = invoices.map((inv) => {
    const outstanding = num(inv.outstandingAmount)
    const due = inv.dueDate.getTime()
    // Only unpaid balances can be overdue — a settled invoice past its due date
    // is not money at risk.
    const daysOverdue =
      outstanding > 0 && due < now ? Math.floor((now - due) / 86_400_000) : 0

    const methods = Array.from(
      new Set(inv.payments.map((p) => p.method).filter(Boolean) as string[])
    ).join(", ")
    const refs = Array.from(
      new Set(inv.payments.map((p) => p.reference).filter(Boolean) as string[])
    ).join(", ")

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: inv.client?.name ?? "Unknown client",
      clientCode: inv.client?.clientCode ?? "",
      clientGstin: inv.clientGstin ?? inv.client?.gstin ?? null,
      assignedTo: inv.client?.assignedEmployeeName ?? null,
      serviceDescription: inv.serviceDescription ?? null,
      serviceType: inv.serviceType ?? null,
      hsnSac: inv.hsnSac ?? null,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      lastPaymentDate: inv.payments[0]?.paymentDate.toISOString() ?? null,
      daysOverdue,
      placeOfSupply: inv.placeOfSupply ?? null,
      placeOfSupplyName: inv.placeOfSupply ? stateName(inv.placeOfSupply) : null,
      professionalFee: numOrNull(inv.professionalFee),
      taxRate: numOrNull(inv.taxRate),
      taxAmount: numOrNull(inv.taxAmount),
      cgstAmount: numOrNull(inv.cgstAmount),
      sgstAmount: numOrNull(inv.sgstAmount),
      igstAmount: numOrNull(inv.igstAmount),
      amount: num(inv.amount),
      paidAmount: num(inv.paidAmount),
      outstandingAmount: outstanding,
      status: inv.status,
      remarks: inv.remarks ?? null,
      revisionNumber: inv.revisionNumber ?? 0,
      revisedFromNumber: inv.revisedFrom?.invoiceNumber ?? null,
      paymentMethods: methods || null,
      paymentReferences: refs || null,
    }
  })

  // Contracted book value. Read across every active engagement, not just the
  // clients that happen to have invoices in the filtered window — an engagement
  // that has never been billed is precisely the one worth seeing.
  const engagements = await prisma.clientService.findMany({
    where: {
      isActive: true,
      // ClientService has no firmId of its own, so the tenant extension injects
      // nothing — without this the contracted total would silently sum every
      // firm on the platform.
      client: { ...clientFirmFilter(session).client, deletedAt: null, status: "ACTIVE" },
    },
    select: { agreedFee: true, frequency: true, billingFrequency: true },
  })

  const contractedAnnual = engagements.reduce((sum, e) => {
    if (e.agreedFee == null) return sum
    return sum + Number(e.agreedFee) * OCCURRENCES_PER_YEAR[e.billingFrequency ?? e.frequency]
  }, 0)

  const summary = {
    invoiced: rows.reduce((s, r) => s + r.amount, 0),
    professionalFees: rows.reduce((s, r) => s + (r.professionalFee ?? 0), 0),
    tax: rows.reduce((s, r) => s + (r.taxAmount ?? 0), 0),
    collected: rows.reduce((s, r) => s + r.paidAmount, 0),
    outstanding: rows.reduce((s, r) => s + r.outstandingAmount, 0),
    overdue: rows.reduce((s, r) => s + (r.daysOverdue > 0 ? r.outstandingAmount : 0), 0),
    invoiceCount: rows.length,
    clientCount: new Set(rows.map((r) => r.clientId)).size,
    contractedAnnual,
    engagementsWithoutFee: engagements.filter((e) => e.agreedFee == null).length,
  }

  const rollup = (
    keyOf: (r: RevenueRow) => { key: string; label: string } | null
  ): RevenueRollup[] => {
    const map = new Map<string, RevenueRollup>()
    for (const r of rows) {
      const k = keyOf(r)
      if (!k) continue
      const existing = map.get(k.key)
      if (existing) {
        existing.amount += r.amount
        existing.count += 1
      } else {
        map.set(k.key, { ...k, amount: r.amount, count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount)
  }

  const byClient = rollup((r) => ({
    key: r.clientId,
    label: r.clientCode ? `${r.clientName} (${r.clientCode})` : r.clientName,
  }))

  const byService = rollup((r) => ({
    key: r.serviceType ?? "UNSPECIFIED",
    label: r.serviceType ?? "Unspecified",
  }))

  // Chronological, not by size — a revenue trend read backwards is useless.
  const byMonth = rollup((r) => {
    const d = new Date(r.issueDate)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_LABEL.format(d),
    }
  }).sort((a, b) => a.key.localeCompare(b.key))

  // Full client list for the filter dropdown — independent of the current slice
  // so filtering to one client doesn't collapse the options to just that one.
  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return {
    rows,
    summary,
    byClient,
    byService,
    byMonth,
    applied: {
      // `short` is the round-trippable key ("2026-27"); `label` already
      // carries its own "FY " prefix, so never re-prefix it.
      fy: wantsAll ? "all" : (fy?.short ?? ""),
      label: wantsAll ? "All time" : (fy?.label ?? ""),
      from: from?.toISOString() ?? null,
      to: to?.toISOString() ?? null,
    },
    clients,
  }
}
