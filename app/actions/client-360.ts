"use server"

import { requireAuth } from "@/lib/auth/guards"
import {
  canAccessAssignedClient,
  getExecutiveEmployeeId,
} from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"

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
    services,
    complianceEvents,
    timelineEvents,
    documentChecklist,
  ] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      include: { assignedEmployee: true },
    }),
    // Per-client lists — bounded to avoid a pathological single client pulling
    // thousands of rows into one page (realistic clients are well under this).
    prisma.task.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: { assignedEmployee: true },
      take: 500,
    }),
    prisma.invoice.findMany({
      where: { clientId },
      orderBy: { dueDate: "desc" },
      take: 500,
    }),
    prisma.clientService.findMany({
      where: { clientId },
    }),
    prisma.complianceEvent.findMany({
      where: { clientId },
      orderBy: { dueDate: "asc" },
      include: { task: { select: { id: true, title: true, status: true } } },
    }),
    prisma.clientTimelineEvent.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // Onboarding document checklist stays (separate from the removed vault).
    prisma.clientDocumentChecklistItem.findMany({
      where: { clientId },
      orderBy: [{ collected: "asc" }, { createdAt: "asc" }],
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
    professionalFee: invoice.professionalFee !== null ? Number(invoice.professionalFee) : null,
    taxRate: invoice.taxRate !== null ? Number(invoice.taxRate) : null,
    taxAmount: invoice.taxAmount !== null ? Number(invoice.taxAmount) : null,
  }))

  // Calculate metrics
  const metrics = {
    totalOpenTasks: tasks.filter((t: any) => t.status !== "FILED_DONE").length,
    overdueTasks: tasks.filter((t: any) => t.isOverdue).length,
    outstandingPayments: serializedInvoices
      .filter((i: any) => i.status === "OVERDUE" || i.status === "SENT")
      .reduce((sum: number, i: any) => sum + i.outstandingAmount, 0),
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
    services,
    complianceEvents,
    timelineEvents,
    documentChecklist,
    metrics,
    user: session.user,
  }
}
