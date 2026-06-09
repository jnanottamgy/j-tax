"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { FormActionState } from "@/lib/forms/types"
import {
  followUpSchema,
  parseInvoiceFormData,
  recordPaymentSchema,
} from "@/lib/validations/invoice"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"

export async function getInvoicesData() {
  // C-09 fix: require authentication
  const session = await requireAuth()

  // PARTNER and MANAGER see all invoices; EXECUTIVE is blocked at the route level
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
  }))

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return { invoices: serializedInvoices, clients, user: session.user }
}

export async function createInvoice(
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  // C-09 fix: only PARTNER/MANAGER can create invoices
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to create invoices." }
  }

  const validation = parseInvoiceFormData(formData)
  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors }
  }

  const data = validation.data
  const amountValue = parseFloat(data.amount)

  try {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: data.invoiceNumber },
    })

    if (existingInvoice) {
      return { error: "An invoice with this number already exists." }
    }

    await prisma.invoice.create({
      data: {
        clientId: data.clientId,
        invoiceNumber: data.invoiceNumber,
        amount: amountValue,
        issueDate: new Date(data.issueDate),
        dueDate: new Date(data.dueDate),
        status: data.status as any,
        outstandingAmount: amountValue,
        paidAmount: 0,
      },
    })

    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    return { success: true }
  } catch (error) {
    console.error("Failed to create invoice:", error)
    return { error: "Failed to create invoice. Please try again." }
  }
}

export async function updateInvoice(invoiceId: string, prevState: any, formData: FormData) {
  // C-09 fix: only PARTNER/MANAGER can update invoices
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to update invoices." }
  }

  const data = {
    status: formData.get("status") as string,
    paidAmount: formData.get("paidAmount") as string | null,
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      return { error: "Invoice not found." }
    }

    const paidAmountValue = data.paidAmount ? parseFloat(data.paidAmount) : Number(invoice.paidAmount)
    const outstandingAmount = Math.max(0, Number(invoice.amount) - paidAmountValue)

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: data.status as any,
        paidAmount: paidAmountValue,
        outstandingAmount,
      },
    })

    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    return { success: true }
  } catch (error) {
    console.error("Failed to update invoice:", error)
    return { error: "Failed to update invoice. Please try again." }
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
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
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

    revalidatePath(`/payments/invoices/${invoiceId}`)
    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
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
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to update invoice status." }
  }

  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) return { error: "Invoice not found." }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    })

    revalidatePath(`/payments/invoices/${invoiceId}`)
    revalidatePath("/payments/invoices")
    revalidatePath("/payments")
    return { success: true }
  } catch (error) {
    console.error("Failed to update invoice status:", error)
    return { error: "Failed to update invoice status. Please try again." }
  }
}
