"use server"

import { revalidatePath } from "next/cache"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { toUserError } from "@/lib/forms/errors"
import { prisma } from "@/lib/prisma"

// ─── Types (erased at runtime — safe in a "use server" module) ────────────────

export type DocumentRequestActionState = {
  success?: boolean
  error?: string
}

export type ClientOption = {
  id: string
  name: string
}

export type DocumentRequestListRow = {
  id: string
  clientId: string
  clientName: string
  title: string
  status: string // OPEN | COMPLETED | CANCELLED
  dueDate: string | null
  lastRemindedAt: string | null
  createdAt: string
  itemStats: {
    total: number
    accepted: number
    uploaded: number
    pending: number
    rejected: number
  }
}

export type DocumentRequestItemDetail = {
  id: string
  title: string
  status: string // PENDING | UPLOADED | ACCEPTED | REJECTED
  rejectionReason: string | null
  sortOrder: number
  document: { id: string; title: string; fileName: string } | null
}

export type DocumentRequestDetail = {
  id: string
  clientId: string
  clientName: string
  title: string
  status: string
  dueDate: string | null
  notes: string | null
  lastRemindedAt: string | null
  createdAt: string
  items: DocumentRequestItemDetail[]
}

export type MyDocumentRequest = {
  id: string
  title: string
  status: string
  dueDate: string | null
  notes: string | null
  createdAt: string
  items: {
    id: string
    title: string
    status: string
    rejectionReason: string | null
    sortOrder: number
  }[]
}

const STAFF_PATH = "/documents/requests"
const PORTAL_PATH = "/client/requests"

function revalidateRequestPaths() {
  revalidatePath(STAFF_PATH)
  revalidatePath(PORTAL_PATH)
}

// ─── Portal identity (mirrors the ambiguity-safe pattern in
//     app/(client-portal)/client/layout.tsx — email match only, refuse
//     ambiguous matches rather than risk cross-client exposure) ───────────────

async function requireMyClient() {
  const session = await requireAuth()
  if (session.user.role !== "CLIENT") {
    throw new Error("Forbidden: Client access required")
  }

  const matches = await prisma.client.findMany({
    where: { email: session.user.email },
    select: { id: true, name: true, assignedEmployeeId: true },
    take: 2,
  })

  if (matches.length === 0) {
    throw new Error("No client record found for your account.")
  }
  if (matches.length > 1) {
    throw new Error("Ambiguous client identity. Please contact your firm.")
  }

  return { session, client: matches[0] }
}

// ═══════════════════════════════════════════════════════════════════════════
// Staff actions (Partner / Manager)
// ═══════════════════════════════════════════════════════════════════════════

export async function getActiveClientOptionsForRequests(): Promise<ClientOption[]> {
  await requirePartnerOrManager()

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return clients
}

export async function createDocumentRequest(input: {
  clientId: string
  title: string
  dueDate?: string
  notes?: string
  items: string[]
}): Promise<DocumentRequestActionState> {
  try {
    const session = await requirePartnerOrManager()

    const title = input.title?.trim()
    if (!title) return { error: "Title is required." }
    if (!input.clientId) return { error: "Client is required." }

    const items = (input.items ?? []).map((t) => t.trim()).filter(Boolean)
    if (items.length === 0) {
      return { error: "Add at least one document item to request." }
    }

    const client = await prisma.client.findFirst({
      where: { id: input.clientId, deletedAt: null },
      select: { id: true },
    })
    if (!client) return { error: "Client not found." }

    let dueDate: Date | null = null
    if (input.dueDate) {
      dueDate = new Date(input.dueDate)
      if (Number.isNaN(dueDate.getTime())) return { error: "Invalid due date." }
    }

    await prisma.documentRequest.create({
      data: {
        clientId: client.id,
        title,
        dueDate,
        notes: input.notes?.trim() || null,
        createdBy: session.user.id,
        items: {
          create: items.map((itemTitle, index) => ({
            title: itemTitle,
            sortOrder: index,
          })),
        },
      },
    })

    revalidateRequestPaths()
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function listDocumentRequests(): Promise<DocumentRequestListRow[]> {
  await requirePartnerOrManager()

  const requests = await prisma.documentRequest.findMany({
    where: { client: { deletedAt: null } },
    include: {
      client: { select: { name: true } },
      items: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return requests.map((req) => {
    const count = (status: string) =>
      req.items.filter((i) => i.status === status).length
    return {
      id: req.id,
      clientId: req.clientId,
      clientName: req.client.name,
      title: req.title,
      status: req.status,
      dueDate: req.dueDate?.toISOString() ?? null,
      lastRemindedAt: req.lastRemindedAt?.toISOString() ?? null,
      createdAt: req.createdAt.toISOString(),
      itemStats: {
        total: req.items.length,
        accepted: count("ACCEPTED"),
        uploaded: count("UPLOADED"),
        pending: count("PENDING"),
        rejected: count("REJECTED"),
      },
    }
  })
}

export async function getDocumentRequest(
  id: string
): Promise<{ request?: DocumentRequestDetail; error?: string }> {
  try {
    await requirePartnerOrManager()

    const req = await prisma.documentRequest.findUnique({
      where: { id },
      include: {
        client: { select: { name: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            document: { select: { id: true, title: true, fileName: true } },
          },
        },
      },
    })

    if (!req) return { error: "Document request not found." }

    return {
      request: {
        id: req.id,
        clientId: req.clientId,
        clientName: req.client.name,
        title: req.title,
        status: req.status,
        dueDate: req.dueDate?.toISOString() ?? null,
        notes: req.notes,
        lastRemindedAt: req.lastRemindedAt?.toISOString() ?? null,
        createdAt: req.createdAt.toISOString(),
        items: req.items.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          rejectionReason: item.rejectionReason,
          sortOrder: item.sortOrder,
          document: item.document
            ? {
                id: item.document.id,
                title: item.document.title,
                fileName: item.document.fileName,
              }
            : null,
        })),
      },
    }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function addRequestItem(
  requestId: string,
  title: string
): Promise<DocumentRequestActionState> {
  try {
    await requirePartnerOrManager()

    const trimmed = title?.trim()
    if (!trimmed) return { error: "Item title is required." }

    const request = await prisma.documentRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    })
    if (!request) return { error: "Document request not found." }
    if (request.status !== "OPEN") {
      return { error: "Items can only be added to open requests." }
    }

    const maxSort = await prisma.documentRequestItem.aggregate({
      where: { requestId },
      _max: { sortOrder: true },
    })

    await prisma.documentRequestItem.create({
      data: {
        requestId,
        title: trimmed,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })

    revalidateRequestPaths()
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function removeRequestItem(
  itemId: string
): Promise<DocumentRequestActionState> {
  try {
    await requirePartnerOrManager()

    const item = await prisma.documentRequestItem.findUnique({
      where: { id: itemId },
      include: { request: { select: { status: true } } },
    })
    if (!item) return { error: "Item not found." }
    if (item.request.status !== "OPEN") {
      return { error: "Items can only be removed from open requests." }
    }
    if (item.status !== "PENDING") {
      return { error: "Only pending items can be removed." }
    }

    await prisma.documentRequestItem.delete({ where: { id: itemId } })

    revalidateRequestPaths()
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function reviewRequestItem(
  itemId: string,
  verdict: "ACCEPTED" | "REJECTED",
  reason?: string
): Promise<DocumentRequestActionState> {
  try {
    await requirePartnerOrManager()

    if (verdict !== "ACCEPTED" && verdict !== "REJECTED") {
      return { error: "Invalid verdict." }
    }

    const item = await prisma.documentRequestItem.findUnique({
      where: { id: itemId },
      include: {
        request: {
          include: { client: { select: { name: true } } },
        },
      },
    })
    if (!item) return { error: "Item not found." }
    if (item.request.status !== "OPEN") {
      return { error: "This request is no longer open." }
    }
    if (item.status !== "UPLOADED") {
      return { error: "Only uploaded items can be reviewed." }
    }

    if (verdict === "REJECTED") {
      const trimmedReason = reason?.trim()
      if (!trimmedReason) {
        return { error: "A rejection reason is required." }
      }
      // Keep documentId so staff can still see what was rejected.
      await prisma.documentRequestItem.update({
        where: { id: itemId },
        data: { status: "REJECTED", rejectionReason: trimmedReason },
      })
    } else {
      await prisma.documentRequestItem.update({
        where: { id: itemId },
        data: { status: "ACCEPTED", rejectionReason: null },
      })

      // If every item on the request is now accepted, complete the request
      // and notify its creator.
      const remaining = await prisma.documentRequestItem.count({
        where: { requestId: item.requestId, status: { not: "ACCEPTED" } },
      })
      if (remaining === 0) {
        await prisma.documentRequest.update({
          where: { id: item.requestId },
          data: { status: "COMPLETED" },
        })
        try {
          await prisma.notification.create({
            data: {
              userId: item.request.createdBy,
              title: "Document request completed",
              message: `All items for "${item.request.title}" (${item.request.client.name}) have been accepted.`,
              type: "INFO",
              entityType: "CLIENT",
              entityId: item.request.clientId,
            },
          })
        } catch (notifyErr) {
          console.error("Document request completion notification failed:", notifyErr)
        }
      }
    }

    revalidateRequestPaths()
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function cancelDocumentRequest(
  id: string
): Promise<DocumentRequestActionState> {
  try {
    await requirePartnerOrManager()

    const request = await prisma.documentRequest.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!request) return { error: "Document request not found." }
    if (request.status !== "OPEN") {
      return { error: "Only open requests can be cancelled." }
    }

    await prisma.documentRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    })

    revalidateRequestPaths()
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Client-portal actions
// ═══════════════════════════════════════════════════════════════════════════

export async function getMyDocumentRequests(): Promise<MyDocumentRequest[]> {
  const { client } = await requireMyClient()

  const requests = await prisma.documentRequest.findMany({
    where: { clientId: client.id, status: "OPEN" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          rejectionReason: true,
          sortOrder: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return requests.map((req) => ({
    id: req.id,
    title: req.title,
    status: req.status,
    dueDate: req.dueDate?.toISOString() ?? null,
    notes: req.notes,
    createdAt: req.createdAt.toISOString(),
    items: req.items,
  }))
}

export async function attachUploadToRequestItem(
  itemId: string,
  documentId: string
): Promise<DocumentRequestActionState> {
  try {
    const { client } = await requireMyClient()

    const item = await prisma.documentRequestItem.findUnique({
      where: { id: itemId },
      include: {
        request: { select: { id: true, clientId: true, status: true, title: true } },
      },
    })
    if (!item || item.request.clientId !== client.id) {
      return { error: "Request item not found." }
    }
    if (item.request.status !== "OPEN") {
      return { error: "This request is no longer open." }
    }
    if (item.status !== "PENDING" && item.status !== "REJECTED") {
      return { error: "This item is not awaiting an upload." }
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, clientId: true },
    })
    if (!document || document.clientId !== client.id) {
      return { error: "Document not found." }
    }

    await prisma.documentRequestItem.update({
      where: { id: itemId },
      data: { status: "UPLOADED", documentId: document.id },
    })

    // Notify the client's assigned employee, if any.
    try {
      if (client.assignedEmployeeId) {
        const employee = await prisma.employee.findUnique({
          where: { id: client.assignedEmployeeId },
          select: { userId: true },
        })
        if (employee?.userId) {
          await prisma.notification.create({
            data: {
              userId: employee.userId,
              title: "Document uploaded for request",
              message: `${client.name} uploaded "${item.title}" for request "${item.request.title}".`,
              type: "DOCUMENT_UPLOADED",
              entityType: "DOCUMENT",
              entityId: document.id,
            },
          })
        }
      }
    } catch (notifyErr) {
      console.error("Request item upload notification failed:", notifyErr)
    }

    revalidateRequestPaths()
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}
