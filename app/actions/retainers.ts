"use server"

import { revalidatePath } from "next/cache"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { clientFirmFilter } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { serviceLabel } from "@/lib/clients/constants"
import { addMonthsClamped, type BillingFrequency } from "@/lib/billing/recurring"
import { toUserError } from "@/lib/forms/errors"

/**
 * Turning a retainer on and off.
 *
 * A ClientService already holds the agreed fee and the billing cadence, so
 * switching one to automatic needs no new record — only a start date and a
 * flag. It is off by default and stays off until somebody says otherwise:
 * billing a client without being asked to is not a safe assumption to make on
 * their behalf.
 */

export type RetainerRow = {
  serviceType: string
  label: string
  agreedFee: number | null
  /** Cadence money is charged on, which is not always the filing cadence. */
  billingFrequency: string
  autoInvoice: boolean
  nextBillingDate: string | null
  lastAutoInvoicedAt: string | null
  /** Why this engagement cannot bill automatically yet, if it cannot. */
  blocker: string | null
}

export async function getClientRetainers(clientId: string): Promise<RetainerRow[]> {
  const session = await requirePartnerOrManager()
  if (!clientId) return []

  const services = await prisma.clientService.findMany({
    // ClientService carries no firmId — the firm has to come through the
    // parent, merged into the nested `client` rather than spread alongside it.
    where: {
      isActive: true,
      client: { ...clientFirmFilter(session).client, id: clientId },
    },
    orderBy: { serviceType: "asc" },
  })

  return services.map((s) => {
    const cadence = (s.billingFrequency ?? s.frequency) as BillingFrequency
    const fee = s.agreedFee != null ? Number(s.agreedFee) : null

    // Stated rather than silently refused at 4am by the cron.
    const blocker =
      cadence === "ONE_TIME"
        ? "One-off work does not recur, so there is nothing to schedule."
        : fee == null || fee <= 0
          ? "No fee agreed on this engagement — there is nothing to invoice."
          : null

    return {
      serviceType: s.serviceType,
      label: serviceLabel(s.serviceType, s.customName),
      agreedFee: fee,
      billingFrequency: cadence,
      autoInvoice: s.autoInvoice,
      nextBillingDate: s.nextBillingDate?.toISOString() ?? null,
      lastAutoInvoicedAt: s.lastAutoInvoicedAt?.toISOString() ?? null,
      blocker,
    }
  })
}

export async function setRetainerBilling(input: {
  clientId: string
  serviceType: string
  enabled: boolean
  /** First date to bill from. Ignored when disabling. */
  startOn?: string
}): Promise<{ success: boolean; error?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to change billing." }
  }

  try {
    const service = await prisma.clientService.findFirst({
      where: {
        serviceType: input.serviceType as never,
        client: { ...clientFirmFilter(session).client, id: input.clientId },
      },
    })
    if (!service) return { success: false, error: "Engagement not found." }

    if (!input.enabled) {
      await prisma.clientService.update({
        where: { id: service.id },
        data: { autoInvoice: false, nextBillingDate: null },
      })
      revalidatePath(`/clients/${input.clientId}`)
      return { success: true }
    }

    const cadence = (service.billingFrequency ?? service.frequency) as BillingFrequency
    if (cadence === "ONE_TIME") {
      return { success: false, error: "One-off work does not recur, so it cannot be scheduled." }
    }
    const fee = service.agreedFee != null ? Number(service.agreedFee) : 0
    if (!(fee > 0)) {
      return {
        success: false,
        error: "Agree a fee on this engagement first — there is nothing to invoice.",
      }
    }

    // Billing starts from the date given, or today. Never back-dated by
    // default: generating six months of arrears on the first run is how a firm
    // sends a client six invoices by accident.
    const start = input.startOn ? new Date(input.startOn) : new Date()
    if (Number.isNaN(start.getTime())) {
      return { success: false, error: "That is not a valid start date." }
    }

    await prisma.clientService.update({
      where: { id: service.id },
      data: { autoInvoice: true, nextBillingDate: start },
    })

    revalidatePath(`/clients/${input.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to change retainer billing:", error)
    return { success: false, error: toUserError(error) }
  }
}

/** Next occurrence after a date, for the "next invoice on …" preview. */
export async function previewNextBilling(
  frequency: BillingFrequency,
  from: string
): Promise<string | null> {
  await requirePartnerOrManager()
  const d = new Date(from)
  if (Number.isNaN(d.getTime()) || frequency === "ONE_TIME") return null
  const months = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : 12
  return addMonthsClamped(d, months).toISOString()
}
