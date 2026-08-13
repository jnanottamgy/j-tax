"use server"

import { z } from "zod"

import { requireAuth } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import type { NotificationType, NotificationEntityType } from "@prisma/client"

const listSchema = z.object({
  includeArchived: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  type: z.string().optional(),
})

export type NotificationDTO = {
  id: string
  userId?: string
  title: string
  message: string
  type: NotificationType
  entityType?: NotificationEntityType | null
  entityId?: string | null
  actionType?: string | null
  read: boolean
  archived: boolean
  createdAt: string
}

function serialize(n: any): NotificationDTO {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    entityType: n.entityType,
    entityId: n.entityId,
    actionType: n.actionType,
    read: n.read,
    archived: n.archived,
    createdAt: n.createdAt.toISOString(),
  }
}

export async function listMyNotifications(input?: {
  includeArchived?: boolean
  limit?: number
  offset?: number
  type?: NotificationType
}) {
  const session = await requireAuth()
  const parsed = listSchema.safeParse(input ?? {})
  if (!parsed.success) throw new Error("Invalid notification query")

  const limit = parsed.data.limit ?? 50
  const offset = parsed.data.offset ?? 0
  const includeArchived = parsed.data.includeArchived ?? false

  const where: any = {
    userId: session.user.id,
    ...(includeArchived ? {} : { archived: false }),
  }

  if (parsed.data.type) {
    where.type = parsed.data.type
  }

  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false, archived: false },
  })

  return { notifications: rows.map(serialize), unreadCount }
}

export async function getRecentNotifications(limit: number = 10) {
  const session = await requireAuth()
  
  const rows = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      archived: false,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false, archived: false },
  })

  return { notifications: rows.map(serialize), unreadCount }
}

export async function getUnreadNotificationCount() {
  const session = await requireAuth()
  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false, archived: false },
  })
  return { unreadCount }
}

export async function markNotificationRead(id: string) {
  const session = await requireAuth()

  const updated = await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  })

  return { success: updated.count > 0 }
}

export async function markAllNotificationsRead() {
  const session = await requireAuth()
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false, archived: false },
    data: { read: true },
  })
  return { success: true }
}

export async function archiveNotification(id: string) {
  const session = await requireAuth()
  const updated = await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { archived: true },
  })
  return { success: updated.count > 0 }
}

export async function unarchiveNotification(id: string) {
  const session = await requireAuth()
  const updated = await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { archived: false },
  })
  return { success: updated.count > 0 }
}

export async function deleteNotification(id: string) {
  const session = await requireAuth()
  const deleted = await prisma.notification.deleteMany({
    where: { id, userId: session.user.id },
  })
  return { success: deleted.count > 0 }
}

export async function archiveAllNotifications() {
  const session = await requireAuth()
  await prisma.notification.updateMany({
    where: { userId: session.user.id, archived: false, read: true },
    data: { archived: true },
  })
  return { success: true }
}

// Notification creation helpers with RBAC
/**
 * Is this user inside the caller's firm?
 *
 * prisma.user is firm-scoped by the tenant extension, so an id belonging to
 * another firm simply does not resolve. Notifications carry no firmId of their
 * own, so every write that names a recipient must pass through here.
 */
async function isRecipientInFirm(userId: string): Promise<boolean> {
  if (!userId) return false
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  return Boolean(user)
}

export async function createNotification(data: {
  userId: string
  title: string
  message: string
  type: NotificationType
  entityType?: NotificationEntityType
  entityId?: string
  actionType?: string
}) {
  const session = await requireAuth()

  // PARTNER and MANAGER can create notifications for any user (task assignments,
  // compliance alerts, payment received, etc.). EMPLOYEE can only self-notify.
  if (session.user.role === "EMPLOYEE" && data.userId !== session.user.id) {
    return { success: false, error: "You can only create notifications for yourself" }
  }

  // Notification has no firmId of its own, so the tenant extension cannot scope
  // this create. Without an explicit check a Partner could push a message —
  // and any link inside it — into another firm's staff inbox. prisma.user is
  // firm-scoped, so a recipient outside this firm resolves to null.
  if (!(await isRecipientInFirm(data.userId))) {
    return { success: false, error: "Recipient not found in your organisation." }
  }

  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      entityType: data.entityType,
      entityId: data.entityId,
      actionType: data.actionType,
    },
  })

  return { success: true, notification: serialize(notification) }
}

// Batch notification creation for system events
export async function createNotifications(data: Array<{
  userId: string
  title: string
  message: string
  type: NotificationType
  entityType?: NotificationEntityType
  entityId?: string
  actionType?: string
}>) {
  const session = await requireAuth()
  
  // RBAC check - only allow authorized users to create bulk notifications
  if (session.user.role !== "PARTNER" && session.user.role !== "MANAGER") {
    return { success: false, error: "Unauthorized" }
  }

  // Same firm-boundary check as the single-recipient path, applied to every
  // distinct recipient before anything is written.
  const recipients = Array.from(new Set(data.map((d) => d.userId)))
  const allowed = new Set<string>()
  for (const id of recipients) {
    if (await isRecipientInFirm(id)) allowed.add(id)
  }
  const scoped = data.filter((d) => allowed.has(d.userId))
  if (scoped.length === 0) {
    return { success: false, error: "No valid recipients in your organisation." }
  }

  const notifications = await prisma.notification.createMany({
    data: scoped.map(d => ({
      userId: d.userId,
      title: d.title,
      message: d.message,
      type: d.type,
      entityType: d.entityType,
      entityId: d.entityId,
      actionType: d.actionType,
    })),
  })

  return { success: true, count: notifications.count }
}