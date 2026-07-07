"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireSession } from "@/lib/auth/session"
import type { FormActionState } from "@/lib/forms/types"
import { prisma } from "@/lib/prisma"

const clientMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message is too long (max 2000 characters)"),
})

/**
 * Client-portal → firm messaging.
 *
 * Stores the message on the client's own communication thread (flagged
 * INBOUND so it renders as "You" in both portals) and notifies the staff
 * users who look after this client.
 */
export async function sendClientMessage(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { error: "Your session has expired. Please sign in again." }
  }

  if (session.user.role !== "CLIENT") {
    return { error: "Only portal clients can send messages here." }
  }

  const parsed = clientMessageSchema.safeParse({
    content: formData.get("content"),
  })
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // Same client resolution as the portal layout — by login email.
  const client = await prisma.client.findFirst({
    where: { email: session.user.email },
    select: { id: true, name: true, assignedEmployee: { select: { userId: true } } },
  })
  if (!client) {
    return { error: "No client account is linked to your login." }
  }

  try {
    await prisma.message.create({
      data: {
        clientId: client.id,
        phoneNumber: session.user.email,
        content: parsed.data.content,
        status: "SENT",
        sentAt: new Date(),
        sentBy: session.user.id,
        metadata: { direction: "INBOUND", channel: "PORTAL" },
      },
    })

    // Notify the staff who handle this client: partners, managers, and the
    // assigned employee (when they have a login).
    const staffUsers = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ["PARTNER", "MANAGER"] } },
          ...(client.assignedEmployee?.userId
            ? [{ id: client.assignedEmployee.userId }]
            : []),
        ],
      },
      select: { id: true },
    })

    if (staffUsers.length > 0) {
      await prisma.notification.createMany({
        data: staffUsers.map((u) => ({
          userId: u.id,
          title: `New message from ${client.name}`,
          message:
            parsed.data.content.length > 120
              ? `${parsed.data.content.slice(0, 117)}...`
              : parsed.data.content,
          type: "INFO" as const,
          entityType: "CLIENT" as const,
          entityId: client.id,
        })),
      })
    }

    revalidatePath("/client/messages")
    revalidatePath("/messaging")
    return { success: true, message: "Message sent to your team." }
  } catch (error) {
    console.error("Failed to send client message:", error)
    return { error: "Failed to send your message. Please try again." }
  }
}
