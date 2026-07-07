import { prisma } from "@/lib/prisma"
import type { NotificationEntityType, NotificationType } from "@prisma/client"

/**
 * In-app notification fan-out used by the hierarchy's reporting flows:
 *  - notifyRoles(["PARTNER"])            → Manager actions that Partners must see
 *  - notifyRoles(["PARTNER","MANAGER"])  → Employee submissions for review
 *  - notifyUser(userId)                  → decisions flowing back to the assignee
 *
 * Fire-and-forget by design: failures are logged, never thrown — a missed
 * notification must not roll back the business action that triggered it.
 */

type NotifyPayload = {
  title: string
  message: string
  type?: NotificationType
  entityType?: NotificationEntityType
  entityId?: string
}

export async function notifyRoles(
  roles: Array<"PARTNER" | "MANAGER">,
  payload: NotifyPayload,
  options?: { excludeUserId?: string }
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: roles },
        ...(options?.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
      },
      select: { id: true },
    })
    if (users.length === 0) return
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: payload.title,
        message: payload.message,
        type: payload.type ?? "INFO",
        entityType: payload.entityType,
        entityId: payload.entityId,
      })),
    })
  } catch (err) {
    console.error("[notify] role fan-out failed:", err)
  }
}

export async function notifyUser(userId: string, payload: NotifyPayload): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type ?? "INFO",
        entityType: payload.entityType,
        entityId: payload.entityId,
      },
    })
  } catch (err) {
    console.error("[notify] user notification failed:", err)
  }
}
