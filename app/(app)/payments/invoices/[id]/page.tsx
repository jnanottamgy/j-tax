import { notFound, redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"
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
    },
  })

  if (!invoice) notFound()

  // Serialize Decimal and Date fields for the client component
  const serialized = {
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
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

  return <InvoiceDetailClient invoice={serialized} />
}
