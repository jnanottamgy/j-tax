"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { clientFirmFilter } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { recordTimelineEvent } from "@/lib/timeline/events"
import { toUserError } from "@/lib/forms/errors"
import { computeGstSplit, stateFromGstin } from "@/lib/invoices/gst"
import { getFirmSettings } from "@/lib/firm-settings"
import { notifyRoles } from "@/lib/notifications/notify"
import {
  computeCreditNote,
  taxAdjustmentStatus,
  type CreditReasonCode,
} from "@/lib/billing/credit-note"

/**
 * Issuing a credit note against an invoice.
 *
 * Revising an invoice replaces a document that has already been reported;
 * waiving one writes it off whole and loses the GST. A credit note is the
 * instrument that actually exists for reducing an issued invoice, and s.34 of
 * the CGST Act is where its rules live.
 */

const creditSchema = z.object({
  invoiceId: z.string().min(1),
  fee: z
    .string()
    .trim()
    .min(1, "How much is being credited?")
    .refine((v) => {
      const n = parseFloat(v)
      return !Number.isNaN(n) && n > 0
    }, "Enter a positive amount"),
  reasonCode: z.enum([
    "FEE_REDUCTION",
    "SERVICE_NOT_RENDERED",
    "DUPLICATE",
    "ERROR",
    "GOODWILL",
  ]),
  reason: z.string().trim().min(3, "Say why — this goes on the credit note."),
})

/** CN-<FY>-NNNN, continuous per firm like the invoice series. */
async function nextCreditNoteNumber(): Promise<string> {
  const all = await prisma.creditNote.findMany({ select: { creditNoteNumber: true } })
  let max = 0
  for (const { creditNoteNumber } of all) {
    const m = creditNoteNumber.match(/(\d+)\s*$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  const now = new Date()
  const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `CN-${fyStart}-${String(max + 1).padStart(4, "0")}`
}

export type CreditNoteRow = {
  id: string
  creditNoteNumber: string
  reasonCode: string
  reason: string
  fee: number
  taxAmount: number
  amount: number
  issueDate: string
}

export async function getCreditNotes(invoiceId: string): Promise<CreditNoteRow[]> {
  await requirePartnerOrManager()
  const rows = await prisma.creditNote.findMany({
    where: { invoiceId },
    orderBy: { issueDate: "desc" },
  })
  return rows.map((r) => ({
    id: r.id,
    creditNoteNumber: r.creditNoteNumber,
    reasonCode: r.reasonCode,
    reason: r.reason,
    fee: Number(r.professionalFee),
    taxAmount: Number(r.taxAmount),
    amount: Number(r.amount),
    issueDate: r.issueDate.toISOString(),
  }))
}

export async function issueCreditNote(
  input: unknown
): Promise<{
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  creditNoteNumber?: string
  note?: string
  refundDue?: number
}> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to issue credit notes." }
  }

  const parsed = creditSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: data.invoiceId,
      deletedAt: null,
      client: clientFirmFilter(session).client,
    },
    include: {
      client: { select: { id: true, name: true, gstin: true } },
      creditNotes: { select: { professionalFee: true } },
    },
  })
  if (!invoice) return { success: false, error: "Invoice not found." }

  // A draft invoice has not been reported to anyone; editing it is the right
  // instrument, and a credit note against it would be a document referencing
  // something the client has never seen.
  if (invoice.status === "DRAFT") {
    return {
      success: false,
      error: "This invoice has not been issued yet. Edit it instead of crediting it.",
    }
  }
  if (invoice.status === "WAIVED") {
    return {
      success: false,
      error: "This invoice has already been written off in full — there is nothing left to credit.",
    }
  }

  const alreadyCredited = invoice.creditNotes.reduce(
    (s, c) => s + Number(c.professionalFee),
    0
  )
  const taxRate = invoice.taxRate != null ? Number(invoice.taxRate) : 0

  const computed = computeCreditNote({
    fee: parseFloat(data.fee),
    taxRate,
    invoiceFee: Number(invoice.professionalFee ?? invoice.amount),
    alreadyCredited,
    alreadySettled: Number(invoice.paidAmount),
    invoiceTotal: Number(invoice.amount),
  })
  if (!computed.ok) return { success: false, fieldErrors: { fee: [computed.error] } }

  const firm = await getFirmSettings()
  const firmState = stateFromGstin(firm.gstin)
  const placeOfSupply = invoice.placeOfSupply ?? firmState
  const split = computeGstSplit({
    taxAmount: computed.taxAmount,
    firmState,
    placeOfSupply,
  })
  const hasSplit = computed.taxAmount > 0 && firmState !== null && placeOfSupply !== null

  const status = taxAdjustmentStatus(invoice.issueDate, new Date())

  try {
    const number = await nextCreditNoteNumber()

    await prisma.$transaction(async (tx) => {
      await tx.creditNote.create({
        data: {
          creditNoteNumber: number,
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          reasonCode: data.reasonCode as CreditReasonCode,
          reason: data.reason.trim(),
          professionalFee: computed.fee,
          taxRate: taxRate || null,
          taxAmount: computed.taxAmount,
          amount: computed.amount,
          placeOfSupply,
          cgstAmount: hasSplit && split.igst === 0 ? split.cgst : null,
          sgstAmount: hasSplit && split.igst === 0 ? split.sgst : null,
          igstAmount: hasSplit && split.igst > 0 ? split.igst : null,
          issuedBy: session.user.id,
        },
      })

      // The credit reduces what the invoice is for, so it reduces what is
      // owed. Status follows the balance, exactly as a payment does — an
      // invoice fully covered by credits is settled, not written off.
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          outstandingAmount: computed.remainingOutstanding,
          status: computed.settlesInvoice ? "PAID" : invoice.status,
        },
      })
    })

    await recordTimelineEvent({
      clientId: invoice.clientId,
      eventType: "INVOICE_CREATED",
      title: `Credit note ${number} issued`,
      description: `₹${computed.amount.toLocaleString("en-IN")} credited against ${invoice.invoiceNumber} — ${data.reason.trim()}`,
      performedBy: session.user.id,
    }).catch(() => { /* the credit note itself is the record */ })

    // Crediting money back is a partner-visible event when a manager does it,
    // the same way waiving is.
    if (session.user.role === "MANAGER") {
      await notifyRoles(
        ["PARTNER"],
        {
          title: `Credit note issued: ${number}`,
          message: `${session.user.name} credited ₹${computed.amount.toLocaleString("en-IN")} against ${invoice.invoiceNumber} for ${invoice.client.name}. Reason: ${data.reason.trim()}`,
          type: "WARNING",
          entityType: "INVOICE",
          entityId: invoice.id,
        },
        { excludeUserId: session.user.id }
      )
    }

    revalidatePath(`/payments/invoices/${invoice.id}`)
    revalidatePath("/payments/invoices")
    revalidatePath(`/clients/${invoice.clientId}`)

    return {
      success: true,
      creditNoteNumber: number,
      note: status.note,
      refundDue: computed.refundDue > 0 ? computed.refundDue : undefined,
    }
  } catch (error) {
    console.error("Failed to issue credit note:", error)
    return { success: false, error: toUserError(error) }
  }
}
