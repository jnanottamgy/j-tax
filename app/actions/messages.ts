"use server"

import { revalidatePath } from "next/cache"
import { toUserError } from "@/lib/forms/errors"
import { z } from "zod"

import {
  requireAuth,
  requirePartnerOrManager,
} from "@/lib/auth/guards"
import {
  canAccessAssignedClient,
  getExecutiveEmployeeId,
} from "@/lib/auth/scope"
import type { FormActionState } from "@/lib/forms/types"
import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/messaging/notification-service"
import { messageSchema, templateSchema } from "@/lib/validations/message"

export type MessageActionState = FormActionState

export async function getMessages(filters?: {
  clientId?: string
  status?: string
  startDate?: Date
  endDate?: Date
}) {
  const session = await requireAuth()
  const executiveEmployeeId = await getExecutiveEmployeeId(session)

  const where: any = {}
  
  if (filters?.clientId) {
    where.clientId = filters.clientId
  }
  
  if (filters?.status) {
    where.status = filters.status
  }
  
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {}
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate
    }
  }
  
  if (executiveEmployeeId) {
    where.client = { assignedEmployeeId: executiveEmployeeId }
  } else if (session.user.role === "EMPLOYEE") {
    return { messages: [], clients: [], user: session.user }
  }
  
  const messages = await prisma.message.findMany({
    where,
    include: {
      client: true,
      template: true,
      logs: {
        orderBy: { timestamp: "desc" },
        take: 5,
      },
    },
    orderBy: [
      { createdAt: "desc" },
    ],
  })
  
  const clients = await prisma.client.findMany({
    where: executiveEmployeeId ? { assignedEmployeeId: executiveEmployeeId } : undefined,
    orderBy: { name: "asc" },
  })
  
  return { messages, clients, user: session.user }
}

export async function getMessageTemplates() {
  const session = await requireAuth()
  
  const templates = await prisma.messageTemplate.findMany({
    where: { isActive: true },
    orderBy: [
      { type: "asc" },
      { name: "asc" },
    ],
  })
  
  return { templates, user: session.user }
}

export async function createMessage(
  _prevState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  try {
    const session = await requireAuth()
    const executiveEmployeeId = await getExecutiveEmployeeId(session)

    const raw = {
      clientId: formData.get("clientId"),
      phoneNumber: formData.get("phoneNumber"),
      content: formData.get("content"),
      templateId: formData.get("templateId") || undefined,
    }

    const parsed = messageSchema.safeParse(raw)

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
    })
    if (!client) {
      return { error: "Client not found." }
    }
    if (
      !canAccessAssignedClient(session, executiveEmployeeId, client.assignedEmployeeId)
    ) {
      return { error: "You can only send messages to clients assigned to you" }
    }

    // Use email as recipient (fallback to phone number if email not available)
    const recipient = client.email || parsed.data.phoneNumber

    // Create the DB record first, then attempt delivery
    const message = await prisma.message.create({
      data: {
        clientId: parsed.data.clientId,
        phoneNumber: recipient,
        templateId: parsed.data.templateId,
        content: parsed.data.content,
        status: "QUEUED",
        sentBy: session.user.id,
        metadata: { provider: "EMAIL" },
      },
    })

    await prisma.messageLog.create({
      data: {
        messageId: message.id,
        status: "QUEUED",
        details: { action: "created", provider: "EMAIL" },
      },
    })

    // Dispatch via notification service
    const sendResult = await notificationService.send({
      channel: "email",
      to: recipient,
      subject: "Message from TaxWise Consultants",
      content: parsed.data.content,
      metadata: {
        messageId: message.id,
        clientId: parsed.data.clientId,
      },
    })

    if (sendResult.success) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          metadata: { externalId: sendResult.messageId },
        },
      })
      await prisma.messageLog.create({
        data: {
          messageId: message.id,
          status: "SENT",
          details: { externalId: sendResult.messageId },
        },
      })
    } else {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: sendResult.error,
          retryCount: 1,
        },
      })
      await prisma.messageLog.create({
        data: {
          messageId: message.id,
          status: "FAILED",
          details: { error: sendResult.error },
        },
      })
      // Return error so the UI can show it, but the record is persisted
      return { error: `Message saved but delivery failed: ${sendResult.error}` }
    }

    revalidatePath("/messaging")
    revalidatePath(`/clients/${parsed.data.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to send messages." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to send message. Please try again." }
  }
}

export async function createTemplate(
  _prevState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  try {
    const session = await requirePartnerOrManager()

    // MED-01: parse JSON safely with error handling
    let variables: unknown
    const rawVars = formData.get("variables")
    if (rawVars) {
      try { variables = JSON.parse(rawVars as string) }
      catch { return { error: "Invalid variables format — must be valid JSON." } }
    }

    const raw = {
      name: formData.get("name"),
      type: formData.get("type") || "CUSTOM",
      content: formData.get("content"),
      variables,
    }

    const parsed = templateSchema.safeParse(raw)

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await prisma.messageTemplate.create({
      data: {
        ...parsed.data,
        createdBy: session.user.id,
      },
    })

    revalidatePath("/messaging")

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to create templates." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to create template. Please try again." }
  }
}

export async function updateTemplate(
  _prevState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  try {
    await requirePartnerOrManager()

    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return { error: "Missing template id" }
    }

    // MED-01: parse JSON safely with error handling
    let variables: unknown
    const rawVars2 = formData.get("variables")
    if (rawVars2) {
      try { variables = JSON.parse(rawVars2 as string) }
      catch { return { error: "Invalid variables format — must be valid JSON." } }
    }

    const raw = {
      name: formData.get("name"),
      type: formData.get("type"),
      content: formData.get("content"),
      variables,
    }

    const parsed = templateSchema.partial().safeParse(raw)

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await prisma.messageTemplate.update({
      where: { id },
      data: parsed.data,
    })

    revalidatePath("/messaging")

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to edit templates." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to update template. Please try again." }
  }
}

export async function deleteTemplate(templateId: string): Promise<MessageActionState> {
  try {
    await requirePartnerOrManager()

    await prisma.messageTemplate.delete({
      where: { id: templateId },
    })

    revalidatePath("/messaging")

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to delete templates." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to delete template. Please try again." }
  }
}

export async function sendBulkReminders(
  clientIds: string[],
  templateId: string
): Promise<MessageActionState & { count?: number }> {
  try {
    const session = await requirePartnerOrManager()

    const template = await prisma.messageTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return { error: "Template not found" }
    }

    const clients = await prisma.client.findMany({
      where: {
        id: { in: clientIds },
        OR: [
          { email: { not: null } },
          { phoneNumber: { not: null } },
        ],
      },
    })

    if (clients.length === 0) {
      return { error: "No clients with email or phone numbers found." }
    }

    let sentCount = 0
    let failedCount = 0

    // Dispatch each message via notification service
    for (const client of clients) {
      const recipient = client.email || client.phoneNumber || ""
      if (!recipient) continue
      
      const content = template.content

      const message = await prisma.message.create({
        data: {
          clientId: client.id,
          phoneNumber: recipient,
          templateId: template.id,
          content,
          status: "QUEUED",
          sentBy: session.user.id,
          metadata: { provider: "EMAIL" },
        },
      })

      const sendResult = await notificationService.send({
        channel: "email",
        to: recipient,
        subject: `${template.type.replace(/_/g, " ")} - TaxWise Consultants`,
        content,
        metadata: {
          messageId: message.id,
          templateId: template.id,
          clientId: client.id,
        },
      })

      if (sendResult.success) {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            metadata: { externalId: sendResult.messageId },
          },
        })
        await prisma.messageLog.create({
          data: {
            messageId: message.id,
            status: "SENT",
            details: { action: "bulk_send", externalId: sendResult.messageId },
          },
        })
        sentCount++
      } else {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            errorMessage: sendResult.error,
            retryCount: 1,
          },
        })
        await prisma.messageLog.create({
          data: {
            messageId: message.id,
            status: "FAILED",
            details: { action: "bulk_send", error: sendResult.error },
          },
        })
        failedCount++
      }
    }

    revalidatePath("/messaging")

    if (failedCount > 0 && sentCount === 0) {
      return { error: `All ${failedCount} messages failed to send.` }
    }

    return {
      success: true,
      count: sentCount,
      ...(failedCount > 0 && { error: `${sentCount} sent, ${failedCount} failed.` }),
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to send bulk messages." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to send bulk reminders. Please try again." }
  }
}

export async function getClientCommunicationHistory(clientId: string) {
  const session = await requireAuth()
  const executiveEmployeeId = await getExecutiveEmployeeId(session)

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  })
  if (!client) {
    throw new Error("Client not found")
  }
  if (
    !canAccessAssignedClient(session, executiveEmployeeId, client.assignedEmployeeId)
  ) {
    throw new Error("You do not have permission to view this client's communication history")
  }
  
  const messages = await prisma.message.findMany({
    where: { clientId },
    include: {
      template: true,
      logs: {
        orderBy: { timestamp: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })
  
  return { messages, user: session.user }
}

export async function updateMessageStatus(
  messageId: string,
  status: "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RETRYING",
  details?: any
): Promise<MessageActionState> {
  try {
    // CRIT-02: require authentication — previously had no auth check at all
    await requireAuth()

    const updateData: any = { status }
    
    if (status === "SENT") {
      updateData.sentAt = new Date()
    } else if (status === "DELIVERED") {
      updateData.deliveredAt = new Date()
    } else if (status === "READ") {
      updateData.readAt = new Date()
    } else if (status === "FAILED") {
      updateData.failedAt = new Date()
      updateData.retryCount = { increment: 1 }
    }
    
    await prisma.message.update({
      where: { id: messageId },
      data: updateData,
    })
    
    await prisma.messageLog.create({
      data: {
        messageId,
        status,
        details: details || {},
      },
    })
    
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to update message status. Please try again." }
  }
}
