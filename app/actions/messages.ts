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
import { renderPlainTextEmail } from "@/lib/messaging/email-html"
import { isWhatsAppConfigured } from "@/lib/messaging/whatsapp-api"
import { getFirmSettings } from "@/lib/firm-settings"
import { messageSchema, templateSchema } from "@/lib/validations/message"

export type MessageActionState = FormActionState

export type MessageChannel = "EMAIL" | "WHATSAPP"

const emailFormat = z.string().email()

/** Channel availability for the messaging UI (banner + disabled options). */
export async function getChannelStatus() {
  await requireAuth()
  return {
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    whatsappConfigured: isWhatsAppConfigured(),
  }
}

/**
 * Resolve + validate the recipient for a channel.
 * Returns { recipient } or { error } with a user-actionable message.
 */
function resolveRecipient(
  client: { email: string | null; whatsapp: string | null; phone: string | null },
  channel: MessageChannel
): { recipient?: string; error?: string } {
  if (channel === "WHATSAPP") {
    const number = client.whatsapp || client.phone
    if (!number) {
      return {
        error:
          "This client has no WhatsApp or phone number on file. Add one in the client profile first.",
      }
    }
    if (number.replace(/\D/g, "").length < 10) {
      return {
        error: `This client's phone number ("${number}") is too short to be a valid WhatsApp number — fix it in the client profile.`,
      }
    }
    return { recipient: number }
  }

  if (!client.email) {
    return {
      error:
        "This client has no email address on file. Add one in the client profile first.",
    }
  }
  if (!emailFormat.safeParse(client.email).success) {
    return {
      error: `This client's email address ("${client.email}") is invalid — fix it in the client profile, then try again.`,
    }
  }
  return { recipient: client.email }
}

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
      content: formData.get("content"),
      templateId: formData.get("templateId") || undefined,
      channel: formData.get("channel") || "EMAIL",
    }

    const parsed = messageSchema.safeParse(raw)

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const channel = parsed.data.channel

    // Fail fast with a clear message instead of a FAILED row + provider error.
    if (channel === "WHATSAPP" && !isWhatsAppConfigured()) {
      return {
        error:
          "WhatsApp is not configured yet. Add WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable it.",
      }
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

    // Validate the recipient BEFORE creating a message row — a malformed
    // address/number can never deliver, so surface it as a field error.
    const resolved = resolveRecipient(client, channel)
    if (!resolved.recipient) {
      return { fieldErrors: { clientId: [resolved.error!] } }
    }
    const recipient = resolved.recipient

    // Create the DB record first, then attempt delivery
    const message = await prisma.message.create({
      data: {
        clientId: parsed.data.clientId,
        phoneNumber: recipient,
        templateId: parsed.data.templateId,
        content: parsed.data.content,
        status: "QUEUED",
        sentBy: session.user.id,
        metadata: { provider: channel },
      },
    })

    await prisma.messageLog.create({
      data: {
        messageId: message.id,
        status: "QUEUED",
        details: { action: "created", provider: channel },
      },
    })

    // Dispatch via notification service.
    // Email: escape the plain-text content and wrap it in the branded shell
    // (raw user text in `html` was an injection vector and broke on < &).
    // WhatsApp: plain text goes out as-is (no HTML).
    const cfgForSubject = await getFirmSettings()
    const sendResult =
      channel === "WHATSAPP"
        ? await notificationService.send({
            channel: "whatsapp",
            to: recipient,
            content: parsed.data.content,
            metadata: {
              messageId: message.id,
              clientId: parsed.data.clientId,
            },
          })
        : await notificationService.send({
            channel: "email",
            to: recipient,
            subject: `Message from ${cfgForSubject.firmName}`,
            content: renderPlainTextEmail({
              content: parsed.data.content,
              firmName: cfgForSubject.firmName,
              firmPhone: cfgForSubject.firmPhone,
              replyToEmail: cfgForSubject.replyToEmail || cfgForSubject.fromEmail,
            }),
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
          metadata: { provider: channel, externalId: sendResult.messageId },
        },
      })
      await prisma.messageLog.create({
        data: {
          messageId: message.id,
          status: "SENT",
          details: { externalId: sendResult.messageId, provider: channel },
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

    return {
      success: true,
      message:
        channel === "WHATSAPP" ? "WhatsApp message sent" : "Email sent successfully",
    }
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
  templateId: string,
  channel: MessageChannel = "EMAIL"
): Promise<MessageActionState & { count?: number }> {
  try {
    const session = await requirePartnerOrManager()

    if (channel === "WHATSAPP" && !isWhatsAppConfigured()) {
      return {
        error:
          "WhatsApp is not configured yet. Add WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable it.",
      }
    }

    const template = await prisma.messageTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template) {
      return { error: "Template not found" }
    }

    // Clients without a usable recipient for the chosen channel are skipped.
    const candidates = await prisma.client.findMany({
      where: { id: { in: clientIds } },
    })
    const clients = candidates.filter(
      (c) => resolveRecipient(c, channel).recipient
    )

    if (clients.length === 0) {
      return {
        error:
          channel === "WHATSAPP"
            ? "None of the selected clients have a WhatsApp/phone number on file."
            : "None of the selected clients have a valid email address on file.",
      }
    }

    let sentCount = 0
    let failedCount = 0
    const skippedCount = clientIds.length - clients.length

    const cfgForBulk = await getFirmSettings()

    // Dispatch each message via notification service
    for (const client of clients) {
      const recipient = resolveRecipient(client, channel).recipient
      if (!recipient) continue

      // Substitute the variables we know at send time; leave others intact.
      const content = template.content
        .replace(/{{client_name}}/g, client.name)
        .replace(/{{client_code}}/g, client.clientCode)

      const message = await prisma.message.create({
        data: {
          clientId: client.id,
          phoneNumber: recipient,
          templateId: template.id,
          content,
          status: "QUEUED",
          sentBy: session.user.id,
          metadata: { provider: channel },
        },
      })

      const sendResult =
        channel === "WHATSAPP"
          ? await notificationService.send({
              channel: "whatsapp",
              to: recipient,
              content,
              metadata: {
                messageId: message.id,
                templateId: template.id,
                clientId: client.id,
              },
            })
          : await notificationService.send({
              channel: "email",
              to: recipient,
              subject: `${template.type.replace(/_/g, " ")} - ${cfgForBulk.firmName}`,
              content: renderPlainTextEmail({
                content,
                firmName: cfgForBulk.firmName,
                firmPhone: cfgForBulk.firmPhone,
                replyToEmail: cfgForBulk.replyToEmail || cfgForBulk.fromEmail,
              }),
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
            metadata: { provider: channel, externalId: sendResult.messageId },
          },
        })
        await prisma.messageLog.create({
          data: {
            messageId: message.id,
            status: "SENT",
            details: { action: "bulk_send", externalId: sendResult.messageId, provider: channel },
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
            details: { action: "bulk_send", error: sendResult.error, provider: channel },
          },
        })
        failedCount++
      }
    }

    revalidatePath("/messaging")

    if (failedCount > 0 && sentCount === 0) {
      return { error: `All ${failedCount} messages failed to send.` }
    }

    const skippedNote =
      skippedCount > 0
        ? ` (${skippedCount} skipped — no ${channel === "WHATSAPP" ? "WhatsApp number" : "valid email"} on file)`
        : ""

    return {
      success: true,
      count: sentCount,
      message: `${sentCount} reminder${sentCount === 1 ? "" : "s"} sent${skippedNote}.`,
      ...(failedCount > 0 && { error: `${sentCount} sent, ${failedCount} failed.${skippedNote}` }),
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
