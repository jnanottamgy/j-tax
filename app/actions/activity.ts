"use server"

import { requireAuth, requirePartner } from "@/lib/auth/guards"
import {
  canAccessAssignedClient,
  getExecutiveEmployeeId,
} from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { getGlobalActivityLogs, getEntityActivityLogs, getUserActivityLogs } from "@/lib/activity/logger"

// Firm-wide activity log — PARTNER only. The `/activity` route is
// PARTNER-restricted at the proxy layer, but this server action is callable
// directly via form submission, so we must enforce the guard here too.
export async function getGlobalTimeline(
  filters?: {
    entityType?: string
    userId?: string
    startDate?: string
    endDate?: string
  },
  limit: number = 100,
  offset: number = 0
) {
  const session = await requirePartner()

  const parsedFilters: any = {}
  if (filters?.entityType) parsedFilters.entityType = filters.entityType
  if (filters?.userId) parsedFilters.userId = filters.userId
  if (filters?.startDate) parsedFilters.startDate = new Date(filters.startDate)
  if (filters?.endDate) parsedFilters.endDate = new Date(filters.endDate)

  const { logs, total } = await getGlobalActivityLogs(parsedFilters, limit, offset)

  return {
    logs,
    total,
    hasMore: offset + limit < total,
    user: session.user,
  }
}

export async function getClientTimeline(clientId: string, limit: number = 50) {
  const session = await requireAuth()

  const executiveEmployeeId = await getExecutiveEmployeeId(session)
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { assignedEmployeeId: true },
  })
  if (!client) {
    throw new Error("Client not found")
  }
  if (
    !canAccessAssignedClient(session, executiveEmployeeId, client.assignedEmployeeId)
  ) {
    throw new Error("You do not have permission to view this client's activity")
  }

  const logs = await getEntityActivityLogs("CLIENT", clientId, limit)

  return {
    logs,
    user: session.user,
  }
}

export async function getTaskTimeline(taskId: string, limit: number = 50) {
  const session = await requireAuth()

  // EMPLOYEEs can only view timelines for tasks assigned to them
  if (session.user.role === "EMPLOYEE") {
    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assignedEmployeeId: true, client: { select: { assignedEmployeeId: true } } },
    })
    if (!task) throw new Error("Task not found")
    const canSee =
      task.assignedEmployeeId === executiveEmployeeId ||
      task.client.assignedEmployeeId === executiveEmployeeId
    if (!canSee) throw new Error("You do not have permission to view this task's activity")
  }

  const logs = await getEntityActivityLogs("TASK", taskId, limit)

  return {
    logs,
    user: session.user,
  }
}

export async function getInvoiceTimeline(invoiceId: string, limit: number = 50) {
  // Invoices are PARTNER/MANAGER only; EMPLOYEEs have no business viewing
  // invoice activity (consistent with /payments route restriction).
  const session = await requireAuth()
  if (session.user.role === "EMPLOYEE") {
    throw new Error("You do not have permission to view invoice activity")
  }

  const logs = await getEntityActivityLogs("INVOICE", invoiceId, limit)

  return {
    logs,
    user: session.user,
  }
}

export async function getDocumentTimeline(documentId: string, limit: number = 50) {
  const session = await requireAuth()

  // EMPLOYEEs can only view timelines for documents on clients assigned to them
  if (session.user.role === "EMPLOYEE") {
    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { client: { select: { assignedEmployeeId: true } } },
    })
    if (!doc) throw new Error("Document not found")
    if (doc.client.assignedEmployeeId !== executiveEmployeeId) {
      throw new Error("You do not have permission to view this document's activity")
    }
  }

  const logs = await getEntityActivityLogs("DOCUMENT", documentId, limit)

  return {
    logs,
    user: session.user,
  }
}

export async function getUserTimeline(userId: string, limit: number = 50) {
  const session = await requireAuth()

  // Permission check - only PARTNER and MANAGER can view other users' activity
  if (session.user.role === "EMPLOYEE" && session.user.id !== userId) {
    throw new Error("You do not have permission to view this user's activity")
  }

  const logs = await getUserActivityLogs(userId, limit)

  return {
    logs,
    user: session.user,
  }
}
