"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"

import { requireSession } from "@/lib/auth/session"
import { resolvePortalClient } from "@/lib/client-portal/resolve"
import { prisma } from "@/lib/prisma"
import { notifyRoles, notifyUser } from "@/lib/notifications/notify"
import { createSignedUploadUrl, fileExists, deleteFile } from "@/lib/storage/storage"
import {
  buildStoragePath,
  documentCategoryFor,
  validateUpload,
} from "@/lib/documents/upload-rules"

/**
 * The other half of a document request: the client actually sending the file.
 *
 * The firm could raise a request and the portal could list what was wanted, and
 * there it stopped — the client emailed the files anyway, and the request sat
 * OPEN until somebody closed it by hand. A tracked request with untracked
 * fulfilment is arguably worse than no tracking, because the list looks like a
 * system of record while the actual documents live in an inbox.
 *
 * Uploads go straight from the browser to Supabase Storage against a
 * short-lived signed URL, not through a server action. A scanned audit file is
 * routinely bigger than the 1 MB server-action body limit, and pushing tens of
 * megabytes through the app server to forward them on is wasted work either way.
 *
 * Ownership never comes from the request. `resolvePortalClient` decides who the
 * caller is, and every item is re-checked against that client — a client id in
 * a form field would be an invitation to upload into somebody else's vault.
 */

export type PortalRequestItem = {
  id: string
  title: string
  status: string
  rejectionReason: string | null
  fileName: string | null
}

export type PortalDocumentRequest = {
  id: string
  title: string
  notes: string | null
  dueDate: string | null
  items: PortalRequestItem[]
}

/** Requests raised against the signed-in client, newest first. */
export async function getMyDocumentRequests(): Promise<PortalDocumentRequest[]> {
  const session = await requireSession()
  if (session.user.role !== "CLIENT") return []

  const resolved = await resolvePortalClient(session)
  if (!resolved.ok) return []

  const rows = await prisma.documentRequest.findMany({
    where: { clientId: resolved.client.id, status: { not: "CANCELLED" } },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { document: { select: { fileName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    dueDate: r.dueDate?.toISOString() ?? null,
    items: r.items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      rejectionReason: i.rejectionReason,
      fileName: i.document?.fileName ?? null,
    })),
  }))
}

/**
 * Resolve a request item and prove it belongs to the caller.
 *
 * Returns the item with its client and firm, or null. Every entry point below
 * goes through this — there is no other way in.
 */
async function ownedItem(itemId: string) {
  const session = await requireSession()
  if (session.user.role !== "CLIENT") return null

  const resolved = await resolvePortalClient(session)
  if (!resolved.ok) return null

  const item = await prisma.documentRequestItem.findUnique({
    where: { id: itemId },
    include: {
      request: { select: { id: true, clientId: true, firmId: true, status: true, title: true } },
    },
  })
  if (!item?.request) return null
  if (item.request.clientId !== resolved.client.id) return null

  return { item, client: resolved.client, session }
}

/**
 * A short-lived URL the browser can PUT one file to.
 *
 * The path is composed from ids the server already trusts; the only
 * client-supplied part is the file name, and that is sanitised. Validation runs
 * here rather than only in the browser, because a signed URL handed out on an
 * unchecked request is a signed URL for anything.
 */
export async function createUploadSlot(input: {
  itemId: string
  fileName: string
  fileSize: number
  fileType: string
}): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const owned = await ownedItem(input.itemId)
  if (!owned) return { error: "That request could not be found." }

  if (owned.item.request.status !== "OPEN") {
    return { error: "This request has been closed. Contact your accountant if you still need to send something." }
  }
  if (owned.item.status === "ACCEPTED") {
    return { error: "This document has already been accepted." }
  }

  const check = validateUpload(input)
  if (!check.ok) return { error: check.error }

  const path = buildStoragePath({
    firmId: owned.item.request.firmId,
    clientId: owned.item.request.clientId,
    requestItemId: owned.item.id,
    fileName: input.fileName,
    unique: randomBytes(12).toString("hex"),
  })

  // upsert: a client replacing a rejected file writes a fresh path anyway
  // (the cuid differs), so this only covers a retried PUT of the same slot.
  const slot = await createSignedUploadUrl(path, { upsert: true })
  if (slot.error || !slot.data) {
    return { error: slot.error ?? "Could not start the upload. Please try again." }
  }

  return slot.data
}

/**
 * Record a file the browser has finished uploading.
 *
 * The object is confirmed to exist before anything is written: a client that
 * abandons the PUT, or a crafted call to this action with a path nothing was
 * uploaded to, must not leave a Document row pointing at nothing and a request
 * item marked satisfied.
 */
export async function confirmRequestedUpload(input: {
  itemId: string
  path: string
  fileName: string
  fileSize: number
  fileType: string
}): Promise<{ success: boolean; error?: string }> {
  const owned = await ownedItem(input.itemId)
  if (!owned) return { success: false, error: "That request could not be found." }

  const check = validateUpload(input)
  if (!check.ok) return { success: false, error: check.error }

  // The path has to be one we would have issued for this item — otherwise a
  // caller could point a request item at any object in the bucket, including
  // another firm's.
  const expectedPrefix = [
    owned.item.request.firmId,
    owned.item.request.clientId,
    "requests",
    owned.item.id,
    "",
  ].join("/")
  if (!input.path.startsWith(expectedPrefix)) {
    return { success: false, error: "That upload could not be verified." }
  }

  const exists = await fileExists(input.path)
  if (!exists.data?.exists) {
    return { success: false, error: "The upload did not finish. Please try again." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          firmId: owned.item.request.firmId,
          clientId: owned.item.request.clientId,
          title: owned.item.title,
          category: documentCategoryFor(input.fileType),
          fileName: input.fileName,
          fileSize: input.fileSize,
          fileType: input.fileType,
          storagePath: input.path,
          uploadedBy: owned.session.user.id,
          description: `Uploaded by the client against "${owned.item.request.title}".`,
        },
      })

      await tx.documentRequestItem.update({
        where: { id: owned.item.id },
        data: {
          documentId: doc.id,
          status: "UPLOADED",
          // A replacement clears the previous refusal; leaving it would show
          // the client a rejection reason for a file they have replaced.
          rejectionReason: null,
        },
      })
    })
  } catch (error) {
    console.error("Failed to record uploaded document:", error)
    return { success: false, error: "Could not record the upload. Please try again." }
  }

  // Somebody has to look at it. A file that arrives silently is the same
  // problem as a file that arrives by email.
  const client = await prisma.client.findUnique({
    where: { id: owned.item.request.clientId },
    select: { name: true, assignedEmployee: { select: { userId: true } } },
  })
  const payload = {
    title: `${client?.name ?? "A client"} uploaded a document`,
    message: `"${owned.item.title}" was uploaded against ${owned.item.request.title}. It is waiting to be accepted or sent back.`,
    type: "INFO" as const,
    entityType: "CLIENT" as const,
    entityId: owned.item.request.clientId,
  }
  if (client?.assignedEmployee?.userId) {
    await notifyUser(client.assignedEmployee.userId, payload)
  } else {
    await notifyRoles(["PARTNER", "MANAGER"], payload)
  }

  revalidatePath("/client/documents")
  revalidatePath(`/clients/${owned.item.request.clientId}`)
  return { success: true }
}

/**
 * Remove a file the client uploaded by mistake, before the firm accepts it.
 *
 * Only their own, only while it is still UPLOADED — once a reviewer has
 * accepted it, it is the firm's record and the client cannot withdraw it.
 */
export async function withdrawUploadedDocument(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  const owned = await ownedItem(itemId)
  if (!owned) return { success: false, error: "That request could not be found." }
  if (owned.item.status !== "UPLOADED") {
    return { success: false, error: "This document can no longer be withdrawn." }
  }
  if (!owned.item.documentId) {
    return { success: false, error: "There is nothing to withdraw." }
  }

  const doc = await prisma.document.findUnique({
    where: { id: owned.item.documentId },
    select: { id: true, storagePath: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.documentRequestItem.update({
      where: { id: owned.item.id },
      data: { documentId: null, status: "PENDING" },
    })
    if (doc) {
      // Soft delete, matching the vault's own convention — the firm's recycle
      // bin should still show that something arrived and was taken back.
      await tx.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } })
    }
  })

  // Best-effort: the row is already detached, and an orphaned object is
  // cheaper than a failed withdrawal.
  if (doc?.storagePath) await deleteFile(doc.storagePath).catch(() => {})

  revalidatePath("/client/documents")
  return { success: true }
}
