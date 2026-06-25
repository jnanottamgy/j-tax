"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"

export async function createInvoice(data: {
  clientId: string
  invoiceNumber: string
  amount: number
  dueDate: Date
}) {
  const invoice = await prisma.invoice.create({
    data: {
      clientId: data.clientId,
      invoiceNumber: data.invoiceNumber,
      amount: data.amount,
      outstandingAmount: data.amount, // initially all outstanding
      dueDate: data.dueDate,
      status: "DRAFT",
    },
  })
  revalidatePath("/payments/invoices")
  return invoice
}

export async function addPaymentReceipt(data: {
  invoiceId: string
  amount: number
  reference?: string
  method?: string
  paymentDate?: Date
}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: data.invoiceId } })
  if (!invoice) throw new Error("Invoice not found")

  // Update invoice totals and status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const receipt = await tx.paymentReceipt.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
        reference: data.reference,
        method: data.method,
        paymentDate: data.paymentDate || new Date(),
      },
    })

    const newPaidAmount = Number(invoice.paidAmount) + data.amount
    const newOutstanding = Number(invoice.amount) - newPaidAmount

    let newStatus = invoice.status
    if (newOutstanding <= 0) {
      newStatus = "PAID"
    } else if (newPaidAmount > 0) {
      newStatus = "PARTIALLY_PAID"
    }

    await tx.invoice.update({
      where: { id: data.invoiceId },
      data: {
        paidAmount: newPaidAmount,
        outstandingAmount: newOutstanding > 0 ? newOutstanding : 0,
        status: newStatus,
      },
    })

    return receipt
  })

  revalidatePath(`/payments/invoices/${data.invoiceId}`)
  revalidatePath("/payments")
  return result
}

export async function logFollowUp(data: {
  invoiceId: string
  notes: string
  followUpBy?: string
}) {
  const followUp = await prisma.followUp.create({
    data: {
      invoiceId: data.invoiceId,
      notes: data.notes,
      followUpBy: data.followUpBy,
    },
  })

  revalidatePath(`/payments/invoices/${data.invoiceId}`)
  return followUp
}

export async function updateInvoiceStatus(invoiceId: string, status: "DISPUTED" | "WAIVED") {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status },
  })
  revalidatePath(`/payments/invoices/${invoiceId}`)
  revalidatePath("/payments")
  return invoice
}
