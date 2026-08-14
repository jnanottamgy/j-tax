import { prisma } from "@/lib/prisma"
import { notifyRoles } from "@/lib/notifications/notify"
import { getFirmSettings } from "@/lib/firm-settings"
import {
  billingPeriodLabel,
  catchUpPeriods,
  decideBilling,
  type BillableEngagement,
  type BillingFrequency,
  type BillingSkipReason,
} from "@/lib/billing/recurring"
import { computeGstSplit, normalizeStateCode, stateFromGstin } from "@/lib/invoices/gst"
import { serviceLabel } from "@/lib/clients/constants"

/**
 * Raises the invoices a retainer engagement owes, so nobody has to remember.
 *
 * Runs per firm inside a tenant context — the caller enters it, every query
 * below is scoped by the Prisma extension.
 *
 * Generated invoices are DRAFT. "Without anyone remembering" means the invoice
 * should exist without being remembered, not that it should reach the client
 * unread: a retainer month often carries an extra out-of-scope line, and a
 * wrong invoice sent automatically costs far more than a right one issued a day
 * late. A partner sees the batch and issues it.
 */

export type RetainerRunResult = {
  created: number
  skipped: Record<BillingSkipReason, number>
  /** Engagements whose catch-up hit the cap — reported, never swallowed. */
  capped: string[]
  errors: string[]
}

const emptySkips = (): Record<BillingSkipReason, number> => ({
  "not-enabled": 0,
  inactive: 0,
  "client-inactive": 0,
  "no-fee": 0,
  "not-recurring": 0,
  "not-due": 0,
  unscheduled: 0,
})

/** Continuous per-firm invoice number, matching the manual path's format. */
async function nextInvoiceNumber(): Promise<string> {
  const all = await prisma.invoice.findMany({
    where: { deletedAt: undefined },
    select: { invoiceNumber: true },
  })
  let max = 0
  for (const { invoiceNumber } of all) {
    const m = invoiceNumber.match(/(\d+)\s*$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  const now = new Date()
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `INV-${fyStart}-${String(max + 1).padStart(4, "0")}`
}

export async function runRetainerBilling(now = new Date()): Promise<RetainerRunResult> {
  const result: RetainerRunResult = {
    created: 0,
    skipped: emptySkips(),
    capped: [],
    errors: [],
  }

  const services = await prisma.clientService.findMany({
    where: { autoInvoice: true },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
          gstin: true,
          stateCode: true,
        },
      },
    },
  })
  if (services.length === 0) return result

  const firm = await getFirmSettings()
  const firmState = stateFromGstin(firm.gstin)
  // Retainers are professional services; the standard rate is what the manual
  // invoice dialog defaults to, and a retainer has no reason to differ.
  const TAX_RATE = 18

  for (const svc of services) {
    if (!svc.client || svc.client.deletedAt) {
      result.skipped["client-inactive"]++
      continue
    }

    const engagement: BillableEngagement = {
      id: svc.id,
      clientId: svc.clientId,
      serviceType: svc.serviceType,
      agreedFee: svc.agreedFee == null ? null : Number(svc.agreedFee),
      // Billing cadence, not filing cadence: monthly GST work is often billed
      // quarterly, which is exactly why billingFrequency exists.
      frequency: (svc.billingFrequency ?? svc.frequency) as BillingFrequency,
      autoInvoice: svc.autoInvoice,
      nextBillingDate: svc.nextBillingDate,
      isActive: svc.isActive,
      clientIsActive: svc.client.status === "ACTIVE",
    }

    const decision = decideBilling(engagement, now)
    if (!decision.bill) {
      result.skipped[decision.reason]++
      continue
    }

    // A schedule that has not run for three months owes three invoices, not
    // one. Collapsing them would quietly lose two months of fees.
    const periods = catchUpPeriods(engagement.frequency, svc.nextBillingDate!, now)
    if (periods.length >= 12) result.capped.push(`${svc.client.name} — ${svc.serviceType}`)

    try {
      for (const periodStart of periods) {
        const label = billingPeriodLabel(engagement.frequency, periodStart)
        const fee = engagement.agreedFee!
        const taxAmount = Math.round(fee * TAX_RATE) / 100
        const total = fee + taxAmount

        const placeOfSupply =
          normalizeStateCode(svc.client.stateCode) ??
          stateFromGstin(svc.client.gstin) ??
          firmState
        const split = computeGstSplit({ taxAmount, firmState, placeOfSupply })
        const hasSplit = taxAmount > 0 && firmState !== null && placeOfSupply !== null

        // Idempotent on the description: a cron that runs twice in a night, or
        // a manual re-trigger, must not bill the same month twice.
        const description = `${serviceLabel(svc.serviceType)} — ${label}`
        const already = await prisma.invoice.findFirst({
          where: { clientId: svc.clientId, serviceDescription: description, deletedAt: null },
          select: { id: true },
        })
        if (already) continue

        await prisma.invoice.create({
          data: {
            invoiceNumber: await nextInvoiceNumber(),
            clientId: svc.clientId,
            serviceDescription: description,
            serviceType: svc.serviceType,
            professionalFee: fee,
            taxRate: TAX_RATE,
            taxAmount,
            amount: total,
            paidAmount: 0,
            outstandingAmount: total,
            issueDate: periodStart,
            // Retainers are billed on standard terms; 15 days matches what the
            // manual dialog suggests.
            dueDate: new Date(periodStart.getTime() + 15 * 86_400_000),
            status: "DRAFT",
            clientGstin: svc.client.gstin,
            placeOfSupply,
            cgstAmount: hasSplit && split.igst === 0 ? split.cgst : null,
            sgstAmount: hasSplit && split.igst === 0 ? split.sgst : null,
            igstAmount: hasSplit && split.igst > 0 ? split.igst : null,
            remarks: "Raised automatically from the retainer schedule.",
          },
        })
        result.created++
      }

      // Advance past every period generated, so the next run starts clean even
      // if some periods were skipped as duplicates.
      const lastPeriod = periods[periods.length - 1]
      const months =
        engagement.frequency === "MONTHLY" ? 1 : engagement.frequency === "QUARTERLY" ? 3 : 12
      const advanced = new Date(lastPeriod)
      advanced.setMonth(advanced.getMonth() + months)

      await prisma.clientService.update({
        where: { id: svc.id },
        data: { nextBillingDate: advanced, lastAutoInvoicedAt: now },
      })
    } catch (err) {
      result.errors.push(
        `${svc.client.name} — ${svc.serviceType}: ${err instanceof Error ? err.message : "Unknown"}`
      )
    }
  }

  if (result.created > 0) {
    await notifyRoles(["PARTNER", "MANAGER"], {
      title: `${result.created} retainer invoice${result.created === 1 ? "" : "s"} raised`,
      message:
        `They are drafts, waiting to be issued. ` +
        (result.skipped["no-fee"] > 0
          ? `${result.skipped["no-fee"]} engagement${result.skipped["no-fee"] === 1 ? " was" : "s were"} skipped because no fee is agreed on the record.`
          : ""),
      type: "INFO",
    })
  }

  return result
}
