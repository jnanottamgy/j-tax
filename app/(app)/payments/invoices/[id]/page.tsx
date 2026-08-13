import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"
import { getFirmSettings } from "@/lib/firm-settings"
import { stateFromGstin } from "@/lib/invoices/gst"
import { InvoiceDetailClient } from "./invoice-detail-client"

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")
  if (session.user.role !== "PARTNER" && session.user.role !== "MANAGER") {
    redirect("/unauthorized")
  }

  const { id } = await params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      payments: { orderBy: { paymentDate: "desc" } },
      followUps: { orderBy: { date: "desc" } },
      revisedFrom: { select: { id: true, invoiceNumber: true, revisionNumber: true } },
      revisions: {
        select: { id: true, invoiceNumber: true, revisionNumber: true, status: true },
        orderBy: { revisionNumber: "asc" },
      },
    },
  })

  if (!invoice) notFound()

  // Firm's own GST state — the edit dialog needs it for the split preview.
  const firmSettings = await getFirmSettings()
  const firmState = stateFromGstin(firmSettings.gstin)

  // Serialize Decimal and Date fields for the client component
  const serialized = {
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
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    payments: invoice.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      paymentDate: p.paymentDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    followUps: invoice.followUps.map((f) => ({
      ...f,
      date: f.date.toISOString(),
      createdAt: f.createdAt.toISOString(),
    })),
  }

  return (
    <InvoiceDetailClient
      invoice={serialized}
      firmState={firmState}
      firmName={firmSettings.firmName}
    />
  )
}
