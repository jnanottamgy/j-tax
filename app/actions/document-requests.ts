"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById } from "@/lib/auth/scope"
import { getSession } from "@/lib/auth/session"
import { getFirmSettings } from "@/lib/firm-settings"
import { notificationService } from "@/lib/messaging/notification-service"
import { prisma } from "@/lib/prisma"
import { recordTimelineEvent } from "@/lib/timeline/events"

/**
 * "What we still need from you."
 *
 * DocumentRequest and DocumentRequestItem had a complete schema and no user
 * interface at all — dead tables. So document chasing happened in whichever of
 * the two live lists someone happened to open, and the client never saw either
 * of them. This is the ask: a dated, remindable list the firm tracks and the
 * client can read in their portal.
 *
 * It is NOT a fourth list. A request is raised FROM the client's document
 * checklist, and accepting an item marks that checklist entry collected — so
 * the checklist stays the single register of what a client owes, and a request
 * is one round of chasing against it.
 *
 * (TaskChecklistItem is a different thing entirely: steps within a task, not
 * documents. It is deliberately left alone.)
 */

const requestSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1, "Give the request a title").max(160),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(z.string().trim().min(1).max(200))
    .min(1, "Ask for at least one document")
    .max(50),
})

function toDate(v?: string): Date | null {
  if (!v?.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export type DocumentRequestItemRow = {
  id: string
  title: string
  status: string
  rejectionReason: string | null
}

export type DocumentRequestRow = {
  id: string
  title: string
  status: string
  dueDate: string | null
  notes: string | null
  lastRemindedAt: string | null
  createdAt: string
  items: DocumentRequestItemRow[]
  outstanding: number
  /** Past its due date with items still outstanding. */
  overdue: boolean
}

function serialize(r: {
  id: string
  title: string
  status: string
  dueDate: Date | null
  notes: string | null
  lastRemindedAt: Date | null
  createdAt: Date
  items: Array<{ id: string; title: string; status: string; rejectionReason: string | null }>
}): DocumentRequestRow {
  const outstanding = r.items.filter((i) => i.status !== "ACCEPTED").length
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    dueDate: r.dueDate?.toISOString() ?? null,
    notes: r.notes,
    lastRemindedAt: r.lastRemindedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    items: r.items,
    outstanding,
    overdue: Boolean(r.dueDate && r.dueDate.getTime() < Date.now() && outstanding > 0),
  }
}

const REQUEST_INCLUDE = {
  items: { orderBy: { sortOrder: "asc" } },
} as const

export async function getDocumentRequests(
  clientId: string
): Promise<DocumentRequestRow[]> {
  const session = await getSession()
  if (!session) return []
  if (!(await canAccessClientById(session, clientId))) return []

  const rows = await prisma.documentRequest.findMany({
    where: { clientId },
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return rows.map(serialize)
}

export async function createDocumentRequest(
  input: unknown
): Promise<{ success: boolean; error?: string; requestId?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to request documents." }
  }

  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the request details.",
    }
  }
  const data = parsed.data

  if (!(await canAccessClientById(session, data.clientId))) {
    return { success: false, error: "Client not found." }
  }

  try {
    const created = await prisma.documentRequest.create({
      data: {
        clientId: data.clientId,
        title: data.title,
        dueDate: toDate(data.dueDate),
        notes: data.notes?.trim() || null,
        status: "OPEN",
        createdBy: session.user.id,
        items: {
          create: data.items.map((title, i) => ({
            title,
            status: "PENDING",
            sortOrder: i,
          })),
        },
      },
    })

    await recordTimelineEvent({
      clientId: data.clientId,
      eventType: "DOCUMENT_REQUESTED",
      title: `Documents requested — ${data.title}`,
      description: `${data.items.length} item${data.items.length === 1 ? "" : "s"}`,
      performedBy: session.user.id,
    }).catch(() => { /* the request is recorded either way */ })

    revalidatePath(`/clients/${data.clientId}`)
    return { success: true, requestId: created.id }
  } catch (error) {
    console.error("Failed to create document request:", error)
    return { success: false, error: "Could not create the request. Please try again." }
  }
}

/**
 * Mark an item received, or bounce it back.
 *
 * ACCEPTED also ticks the matching entry on the client's standing document
 * checklist — the two lists were previously independent, which is how the same
 * document ended up chased twice.
 */
export async function setRequestItemStatus(
  itemId: string,
  status: "PENDING" | "ACCEPTED" | "REJECTED",
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "Permission denied." }
  }

  // DocumentRequestItem carries no firmId — it hangs off DocumentRequest, which
  // does. Reaching the firm through the parent is what keeps an id from another
  // firm from resolving.
  const item = await prisma.documentRequestItem.findFirst({
    where: { id: itemId, request: { firmId: session.user.firmId ?? "__none__" } },
    select: { id: true, title: true, requestId: true, request: { select: { clientId: true } } },
  })
  if (!item) return { success: false, error: "Item not found." }

  await prisma.documentRequestItem.update({
    where: { id: itemId },
    data: {
      status,
      rejectionReason: status === "REJECTED" ? rejectionReason?.trim() || null : null,
    },
  })

  if (status === "ACCEPTED") {
    await prisma.clientDocumentChecklistItem
      .updateMany({
        where: { clientId: item.request.clientId, label: item.title, collected: false },
        data: { collected: true, collectedAt: new Date() },
      })
      .catch(() => { /* the request item is accepted regardless */ })
  }

  // A request with nothing outstanding closes itself — leaving it OPEN would
  // keep it in the chase list and in the client's portal forever.
  const remaining = await prisma.documentRequestItem.count({
    where: { requestId: item.requestId, status: { not: "ACCEPTED" } },
  })
  await prisma.documentRequest.updateMany({
    where: { id: item.requestId },
    data: { status: remaining === 0 ? "COMPLETED" : "OPEN" },
  })

  revalidatePath(`/clients/${item.request.clientId}`)
  return { success: true }
}

export async function closeDocumentRequest(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, error: "Permission denied." }
  }
  const result = await prisma.documentRequest.updateMany({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  })
  if (result.count === 0) return { success: false, error: "Request not found." }
  return { success: true }
}

/** Email the client the outstanding items, and stamp the chase. */
export async function sendDocumentRequestReminder(
  requestId: string
): Promise<{ success: boolean; error?: string; sentTo?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "Permission denied." }
  }

  const request = await prisma.documentRequest.findUnique({
    where: { id: requestId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      client: { select: { id: true, name: true, email: true } },
    },
  })
  if (!request) return { success: false, error: "Request not found." }
  if (!request.client.email?.trim()) {
    return {
      success: false,
      error: `${request.client.name} has no email address on file, so there is nowhere to send this.`,
    }
  }

  const outstanding = request.items.filter((i) => i.status !== "ACCEPTED")
  if (outstanding.length === 0) {
    return { success: false, error: "Everything on this request has already been received." }
  }

  const cfg = await getFirmSettings()
  const due = request.dueDate
    ? new Date(request.dueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#1e3a8a;padding:24px;border-radius:10px 10px 0 0;">
      <h1 style="color:white;margin:0;font-size:22px;">${cfg.firmName}</h1>
      <p style="color:#bfdbfe;margin:6px 0 0;font-size:15px;">Documents we still need</p>
    </div>
    <div style="background:#f9fafb;padding:26px;border-radius:0 0 10px 10px;">
      <p>Dear ${request.client.name},</p>
      <p>To carry on with <strong>${request.title}</strong> we still need the following${
        due ? `, ideally by <strong>${due}</strong>` : ""
      }:</p>
      <ul style="padding-left:20px;">
        ${outstanding.map((i) => `<li style="margin:6px 0;">${i.title}</li>`).join("")}
      </ul>
      ${request.notes ? `<p style="color:#4b5563;">${request.notes}</p>` : ""}
      <p style="margin-top:20px;">Just reply to this email with them attached, and do let us know if anything is difficult to get hold of.</p>
      <p style="margin-top:20px;color:#6b7280;font-size:13px;">${cfg.firmName}${
        cfg.firmPhone ? ` · ${cfg.firmPhone}` : ""
      }</p>
    </div>
  </div>
</body></html>`

  const result = await notificationService.send({
    channel: "email",
    to: request.client.email.trim(),
    subject: `${outstanding.length} document${outstanding.length === 1 ? "" : "s"} still needed — ${request.title}`,
    content: html,
  })

  if (!result.success) {
    return { success: false, error: result.error ?? "The email could not be sent." }
  }

  await prisma.documentRequest.updateMany({
    where: { id: requestId },
    data: { lastRemindedAt: new Date() },
  })

  await recordTimelineEvent({
    clientId: request.client.id,
    eventType: "EMAIL_SENT",
    title: `Document reminder sent — ${request.title}`,
    description: `${outstanding.length} item${outstanding.length === 1 ? "" : "s"} outstanding`,
    performedBy: session.user.id,
  }).catch(() => { /* the mail already went */ })

  revalidatePath(`/clients/${request.client.id}`)
  return { success: true, sentTo: request.client.email }
}

/**
 * What this client can see in their own portal.
 *
 * Read-only: the portal has no file upload yet, because nothing in the app
 * writes a Document row at all. Showing the client the list is still most of
 * the value — they know what is outstanding without having to ask.
 */
export async function getMyOutstandingDocuments(clientId: string): Promise<
  Array<{ id: string; title: string; dueDate: string | null; items: string[] }>
> {
  const rows = await prisma.documentRequest.findMany({
    where: { clientId, status: "OPEN" },
    include: REQUEST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.dueDate?.toISOString() ?? null,
      items: r.items.filter((i) => i.status !== "ACCEPTED").map((i) => i.title),
    }))
    .filter((r) => r.items.length > 0)
}
