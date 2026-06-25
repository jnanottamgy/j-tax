"use server"

import { requireAuth } from "@/lib/auth/guards"
import {
  canAccessAssignedClient,
  getExecutiveEmployeeId,
} from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { getClientDocumentCompleteness } from "./documents"

export async function getClient360Data(clientId: string) {
  const session = await requireAuth()
  const executiveEmployeeId = await getExecutiveEmployeeId(session)

  const accessClient = await prisma.client.findUnique({
    where: { id: clientId },
    select: { assignedEmployeeId: true },
  })
  if (!accessClient) {
    throw new Error("Client not found")
  }
  if (
    !canAccessAssignedClient(session, executiveEmployeeId, accessClient.assignedEmployeeId)
  ) {
    throw new Error("You do not have permission to view this client")
  }

  // Fetch all client-related data in parallel
  const [
    client,
    tasks,
    invoices,
    documents,
    services,
    complianceEvents,
    documentCompleteness,
    timelineEvents,
  ] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      include: { assignedEmployee: true },
    }),
    prisma.task.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: { assignedEmployee: true },
    }),
    prisma.invoice.findMany({
      where: { clientId },
      orderBy: { dueDate: "desc" },
    }),
    prisma.document.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientService.findMany({
      where: { clientId },
    }),
    prisma.complianceEvent.findMany({
      where: { clientId },
      orderBy: { dueDate: "asc" },
      include: { task: { select: { id: true, title: true, status: true } } },
    }),
    getClientDocumentCompleteness(clientId),
    prisma.clientTimelineEvent.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  if (!client) {
    throw new Error("Client not found")
  }

  const now = new Date()
  const completedCount = complianceEvents.filter((e) => e.status === "COMPLETED").length
  const overdueCount = complianceEvents.filter(
    (e) => e.status === "OVERDUE" || (e.dueDate < now && e.status !== "COMPLETED")
  ).length
  const complianceScore =
    complianceEvents.length > 0
      ? Math.max(0, Math.min(100, Math.round((completedCount / complianceEvents.length) * 100) - Math.round((overdueCount / complianceEvents.length) * 50)))
      : 100

  // Serialize Decimal objects to numbers for client components
  const serializedInvoices = invoices.map(invoice => ({
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
  }))

  // Calculate metrics
  const metrics = {
    totalOpenTasks: tasks.filter((t: any) => t.status !== "FILED_DONE").length,
    overdueTasks: tasks.filter((t: any) => t.isOverdue).length,
    outstandingPayments: serializedInvoices
      .filter((i: any) => i.status === "OVERDUE" || i.status === "SENT")
      .reduce((sum: number, i: any) => sum + i.outstandingAmount, 0),
    documentsUploaded: documents.length,
    activeServices: services.filter((s: any) => s.isActive).length,
    upcomingCompliance: complianceEvents.filter(
      (e) => e.dueDate >= now && e.status !== "COMPLETED"
    ).length,
    complianceScore,
    overdueCompliance: overdueCount,
  }

  return {
    client,
    tasks,
    invoices: serializedInvoices,
    documents,
    services,
    complianceEvents,
    documentCompleteness,
    timelineEvents,
    metrics,
    user: session.user,
  }
}
