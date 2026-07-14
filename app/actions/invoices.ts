"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { recordTimelineEvent } from "@/lib/timeline/events"
import { getFirmSettings } from "@/lib/firm-settings"
import {
  computeGstSplit,
  normalizeStateCode,
  stateFromGstin,
} from "@/lib/invoices/gst"
import type { FormActionState } from "@/lib/forms/types"
import {
  followUpSchema,
  parseInvoiceFormData,
  recordPaymentSchema,
} from "@/lib/validations/invoice"

import { requireAuth, requirePartner, requirePartnerOrManager } from "@/lib/auth/guards"
import { toUserError } from "@/lib/forms/errors"

const VALID_INVOICE_STATUSES = [
  "DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED", "WAIVED",
] as const
type InvoiceStatus = typeof VALID_INVOICE_STATUSES[number]

/**
 * Generate the next continuous, per-firm invoice number (INV-<FY>-NNNN).
 * Invoice numbers are auto-generated and never user-editable.
 *
 * Includes soft-deleted rows in the max (passing an explicit `deletedAt` key
 * opts out of the soft-delete filter) so a recycled invoice's number is never
 * reused — its `@@unique([firmId, invoiceNumber])` row still exists.
 * Query is firm-scoped by the tenant extension.
 */
async function generateInvoiceNumber(): Promise<string> {
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

/**
 * Resolve everything the GST split needs for an invoice:
 *   - clientGstin snapshot (from the client row at issue time)
 *   - placeOfSupply: explicit form value || client stateCode || client GSTIN
 *     state || firm state (2-digit GST state code)
 *   - CGST/SGST (intra-state) or IGST (inter-state) amounts.
 *
 * Splits are persisted only when the tax amount is positive AND both states
 * could be resolved — otherwise the columns stay null and the UI/PDF fall
 * back to the plain "GST @ x%" line (legacy behavior).
 */
async function resolveGstFields(
  clientId: string,
  formPlaceOfSupply: string | undefined,
  taxAmount: number
) {
  const [client, firm] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { gstin: true, stateCode: true },
    }),
    getFirmSettings(),
  ])

  const firmState = stateFromGstin(firm.gstin)
  const clientState =
    normalizeStateCode(client?.stateCode) ?? stateFromGstin(client?.gstin)
  const placeOfSupply = formPlaceOfSupply ?? clientState ?? firmState

  const split = computeGstSplit({ taxAmount, firmState, placeOfSupply })
  const hasSplit = taxAmount > 0 && firmState !== null && placeOfSupply !== null

  return {
    clientGstin: client?.gstin ?? null,
    placeOfSupply,
    cgstAmount: hasSplit && split.igst === 0 ? split.cgst : null,
    sgstAmount: hasSplit && split.igst === 0 ? split.sgst : null,
    igstAmount: hasSplit && split.igst > 0 ? split.igst : null,
  }
}

export async function getInvoicesData() {
  // Defense-in-depth: gate the action itself on PARTNER/MANAGER, not just the
  // route — a bare requireAuth would have exposed every invoice to an EMPLOYEE
  // who invoked the action directly.
  const session = await requirePartnerOrManager()

  const invoices = await prisma.invoice.findMany({
    include: { client: true },
    orderBy: { createdAt: "desc" },
  })

  // Convert Decimal objects to numbers for client components
  const serializedInvoices = invoices.map(invoice => ({
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
    professionalFee: invoice.professionalFee !== null ? Number(invoice.professionalFee) : null,
    taxRate: invoice.taxRate !== null ? Number(invoice.taxRate) : null,
    taxAmount: invoice.taxAmount !== null ? Number(invoice.taxAmount) : null,
    cgstAmount: invoice.cgstAmount !== null ? Number(invoice.cgstAmount) : null,
    sgstAmount: invoice.sgstAmount !== null ? Number(invoice.sgstAmount) : null,
    igstAmount: invoice.igstAmount !== null ? Number(invoice.igstAmount) : null,
  }))

  // gstin/stateCode ride along so the New Invoice dialog can auto-default the
  // place of supply as soon as a client is picked.
  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, gstin: true, stateCode: true },
    orderBy: { name: "asc" },
  })

  // Firm's own GST state — the dialogs need it for the live CGST/SGST vs IGST preview.
  const firmSettings = await getFirmSettings()
  const firmState = stateFromGstin(firmSettings.gstin)

  return { invoices: serializedInvoices, clients, firmState, user: session.user }
}

export async function createInvoice(
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  // C-09 fix: only PARTNER/MANAGER can create invoices
  let session: Awaited<ReturnType<typeof requirePartnerOrManager>>
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to create invoices." }
  }

  const validation = parseInvoiceFormData(formData)
  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors }
  }

  const data = validation.data
  const professionalFee = parseFloat(data.professionalFee)

  if (isNaN(professionalFee) || professionalFee <= 0) {
    return {
      fieldErrors: { professionalFee: ["Professional fee must be greater than zero."] },
    }
  }

  // Service billing: total payable = professional fee + GST at the chosen slab
  const taxRate = parseFloat(data.taxRate)
  const taxAmount = Math.round(professionalFee * taxRate) / 100
  const totalAmount = professionalFee + taxAmount

  // Optional: the task this invoice is being raised from (task→invoice flow).
  const sourceTaskRaw = formData.get("sourceTaskId")
  const sourceTaskId = typeof sourceTaskRaw === "string" && sourceTaskRaw ? sourceTaskRaw : null

  try {
    // GST tax-invoice fields: recipient GSTIN snapshot, place of supply, and
    // the CGST/SGST vs IGST split derived from taxAmount.
    const gst = await resolveGstFields(data.clientId, data.placeOfSupply, taxAmount)

    // Auto-generate a continuous invoice number; retry on the rare unique race.
    let newInvoice: Awaited<ReturnType<typeof prisma.invoice.create>> | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const invoiceNumber = await generateInvoiceNumber()
      try {
        newInvoice = await prisma.invoice.create({
          data: {
            clientId: data.clientId,
            invoiceNumber,
            sourceTaskId,
            amount: totalAmount,
            serviceDescription: data.serviceDescription,
            serviceType: data.serviceType ?? null,
            professionalFee,
            taxRate,
            taxAmount,
            clientGstin: gst.clientGstin,
            placeOfSupply: gst.placeOfSupply,
            hsnSac: data.hsnSac || "9982",
            cgstAmount: gst.cgstAmount,
            sgstAmount: gst.sgstAmount,
            igstAmount: gst.igstAmount,
            remarks: data.remarks?.trim() ? data.remarks : null,
            issueDate: new Date(data.issueDate),
            dueDate: new Date(data.dueDate),
            status: data.status as any,
            outstandingAmount: totalAmount,
            paidAmount: 0,
          },
        })
        break
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 4) continue
        throw e
      }
    }
    if (!newInvoice) return { error: "Could not generate an invoice number. Please try again." }

    await recordTimelineEvent({
      clientId: data.clientId,
      eventType: "INVOICE_CREATED",
      title: `Invoice ${newInvoice.invoiceNumber} created`,
      description: `${data.serviceDescription} — ₹${totalAmount.toLocaleString("en-IN")} (incl. GST)`,
      performedBy: session.user.id,
    })

    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    revalidatePath(`/clients/${data.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to create invoice:", error)
    return { error: "Failed to create invoice. Please try again." }
  }
}

export async function updateInvoice(
  invoiceId: string,
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to update invoices." }
  }

  const statusRaw = formData.get("status") as string

  // paidAmount is NOT settable here: the PaymentReceipt ledger (via
  // recordPayment) is the single source of truth for what has been paid.
  // PAID / PARTIALLY_PAID are ledger-derived and cannot be set manually, or
  // status and paidAmount would silently diverge from the receipts.
  const SETTABLE_STATUSES = ["DRAFT", "SENT", "OVERDUE", "DISPUTED", "WAIVED"] as const
  if (statusRaw && !(SETTABLE_STATUSES as readonly string[]).includes(statusRaw)) {
    return {
      error:
        "Paid / partially-paid status is derived from recorded payments and cannot be set directly. Use Record Payment or Waive instead.",
    }
  }
  const status = statusRaw as (typeof SETTABLE_STATUSES)[number] | null

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return { error: "Invoice not found." }

    // Full financial edit is DRAFT-only (accounting immutability: once an
    // invoice is SENT it must not change). We treat the presence of a
    // `serviceDescription` field as the signal that this is a full edit rather
    // than a status-only flip from another caller.
    const isFullEdit =
      invoice.status === "DRAFT" && formData.get("serviceDescription") !== null

    if (isFullEdit) {
      const validation = parseInvoiceFormData(formData)
      if (!validation.success) {
        return { fieldErrors: validation.error.flatten().fieldErrors }
      }

      const data = validation.data
      const professionalFee = parseFloat(data.professionalFee)
      if (isNaN(professionalFee) || professionalFee <= 0) {
        return {
          fieldErrors: { professionalFee: ["Professional fee must be greater than zero."] },
        }
      }

      // Same billing math as createInvoice: total = fee + GST at the chosen slab.
      const taxRate = parseFloat(data.taxRate)
      const taxAmount = Math.round(professionalFee * taxRate) / 100
      const totalAmount = professionalFee + taxAmount

      // Same GST recompute as createInvoice — the split must track the edited
      // fee/rate/place-of-supply. Uses the invoice's own clientId (immutable).
      const gst = await resolveGstFields(
        invoice.clientId,
        data.placeOfSupply,
        taxAmount
      )

      // clientId and invoiceNumber are validated (parseInvoiceFormData reads
      // them) but MUST NOT change — a draft edit keeps the invoice's identity.
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          serviceDescription: data.serviceDescription,
          serviceType: data.serviceType ?? null,
          professionalFee,
          taxRate,
          taxAmount,
          clientGstin: gst.clientGstin,
          placeOfSupply: gst.placeOfSupply,
          hsnSac: data.hsnSac || "9982",
          cgstAmount: gst.cgstAmount,
          sgstAmount: gst.sgstAmount,
          igstAmount: gst.igstAmount,
          amount: totalAmount,
          // A draft has paidAmount 0, so the full amount is outstanding.
          outstandingAmount: totalAmount,
          remarks: data.remarks?.trim() ? data.remarks : null,
          issueDate: new Date(data.issueDate),
          dueDate: new Date(data.dueDate),
          ...(status ? { status } : {}),
        },
      })

      revalidatePath(`/payments/invoices/${invoiceId}`)
      revalidatePath("/payments/invoices")
      revalidatePath("/payments")
      revalidatePath(`/clients/${invoice.clientId}`)
      return { success: true }
    }

    // Status-only path (used by other callers): never touches financial fields,
    // and non-draft invoices can only change status among SETTABLE_STATUSES.
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(status ? { status } : {}),
      },
    })

    revalidatePath(`/payments/invoices/${invoiceId}`)
    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    revalidatePath(`/clients/${invoice.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to update invoice:", error)
    return { error: toUserError(error) }
  }
}

export async function recordPayment(
  invoiceId: string,
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to record payments." }
  }

  const parsed = recordPaymentSchema.safeParse({
    amount: formData.get("amount"),
    method: formData.get("method") ?? "",
    reference: formData.get("reference") ?? "",
  })

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const amount = parseFloat(parsed.data.amount)
  const method = parsed.data.method?.trim() || undefined
  const reference = parsed.data.reference?.trim() || undefined

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: { select: { name: true } } },
    })
    if (!invoice) return { error: "Invoice not found." }

    // Validate invoice status - prevent payments on final-status invoices
    if (invoice.status === "PAID") {
      return { error: "This invoice is already fully paid." }
    }
    if (invoice.status === "WAIVED") {
      return { error: "This invoice has been waived. Payments cannot be recorded." }
    }
    if (invoice.status === "DISPUTED") {
      return { error: "This invoice is disputed. Resolve the dispute before recording payments." }
    }

    // Validate payment amount does not exceed outstanding amount
    const outstandingAmount = Number(invoice.outstandingAmount)
    if (amount > outstandingAmount) {
      return { error: `Payment amount (₹${amount.toLocaleString("en-IN")}) exceeds outstanding amount (₹${outstandingAmount.toLocaleString("en-IN")}).` }
    }

    const newPaid = Number(invoice.paidAmount) + amount
    const newOutstanding = Math.max(0, Number(invoice.amount) - newPaid)
    const newStatus =
      newOutstanding === 0
        ? "PAID"
        : newPaid > 0
        ? "PARTIALLY_PAID"
        : invoice.status

    await prisma.$transaction([
      prisma.paymentReceipt.create({
        data: {
          invoiceId,
          amount,
          method: method ?? null,
          reference: reference ?? null,
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaid,
          outstandingAmount: newOutstanding,
          status: newStatus as any,
        },
      }),
    ])

    // Timeline event
    await recordTimelineEvent({
      clientId: invoice.clientId,
      eventType: "PAYMENT_RECEIVED",
      title: `Payment received: ₹${amount.toLocaleString("en-IN")}`,
      description: `Invoice ${invoice.invoiceNumber}${method ? ` via ${method}` : ""}`,
    })

    // Notify all PARTNER/MANAGER users about the received payment
    try {
      const managers = await prisma.user.findMany({
        where: { role: { in: ["PARTNER", "MANAGER"] } },
        select: { id: true },
      })
      if (managers.length > 0) {
        await prisma.notification.createMany({
          data: managers.map((u) => ({
            userId: u.id,
            title: "Payment Received",
            message: `₹${amount.toLocaleString("en-IN")} received for invoice ${invoice.invoiceNumber} from ${invoice.client.name}.`,
            type: "PAYMENT_RECEIVED" as const,
            entityType: "INVOICE" as const,
            entityId: invoiceId,
          })),
        })
      }
    } catch (logErr) { console.error("payment notification log failed:", logErr) }

    revalidatePath(`/payments/invoices/${invoiceId}`)
    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    revalidatePath(`/clients/${invoice.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to record payment:", error)
    return { error: "Failed to record payment. Please try again." }
  }
}

export async function logFollowUp(
  invoiceId: string,
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to log follow-ups." }
  }

  const parsed = followUpSchema.safeParse({
    notes: formData.get("notes"),
  })

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const notes = parsed.data.notes

  try {
    const session = await requirePartnerOrManager()
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return { error: "Invoice not found." }

    await prisma.followUp.create({
      data: {
        invoiceId,
        notes,
        followUpBy: session.user.name,
      },
    })

    revalidatePath(`/payments/invoices/${invoiceId}`)
    revalidatePath(`/clients/${invoice.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to log follow-up:", error)
    return { error: "Failed to log follow-up. Please try again." }
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: "DISPUTED" | "WAIVED" | "SENT" | "DRAFT"
) {
  let session: Awaited<ReturnType<typeof requirePartnerOrManager>>
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to update invoice status." }
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: { select: { name: true } } },
    })
    if (!invoice) return { error: "Invoice not found." }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    })

    // Waiving money is a Partner-visibility event when a Manager does it.
    if (status === "WAIVED" && session.user.role === "MANAGER") {
      const { notifyRoles } = await import("@/lib/notifications/notify")
      await notifyRoles(
        ["PARTNER"],
        {
          title: `Invoice waived: ${invoice.invoiceNumber}`,
          message: `${session.user.name} waived ${invoice.invoiceNumber} (${invoice.client.name}, ₹${Number(invoice.amount).toLocaleString("en-IN")}).`,
          type: "WARNING",
          entityType: "INVOICE",
          entityId: invoiceId,
        },
        { excludeUserId: session.user.id }
      )
    }

    revalidatePath(`/payments/invoices/${invoiceId}`)
    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    revalidatePath(`/clients/${invoice.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to update invoice status:", error)
    return { error: "Failed to update invoice status. Please try again." }
  }
}

export async function deleteInvoice(invoiceId: string): Promise<FormActionState> {
  // Deleting invoices is PARTNER-only (managers can create/manage but not delete).
  try {
    await requirePartner()
  } catch {
    return { error: "You do not have permission to delete invoices." }
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: { select: { name: true } } },
    })
    if (!invoice) return { error: "Invoice not found." }

    if (Number(invoice.paidAmount) > 0) {
      return { error: "Cannot delete an invoice that has payments recorded. Mark it as Waived instead." }
    }
    if (invoice.status === "PAID") {
      return { error: "Cannot delete a fully paid invoice." }
    }

    // Soft delete → recycle bin. Restore/purge live in app/actions/trash.ts.
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { deletedAt: new Date() },
    })

    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    revalidatePath(`/clients/${invoice.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to delete invoice:", error)
    return { error: toUserError(error) }
  }
}
