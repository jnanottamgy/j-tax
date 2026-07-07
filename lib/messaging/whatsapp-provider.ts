/**
 * WhatsApp Notification Provider (Meta Cloud API)
 *
 * Adapts lib/messaging/whatsapp-api.ts to the NotificationProvider contract so
 * the notification service can dispatch to "whatsapp" exactly like "email".
 *
 * Degrades gracefully: when WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID are
 * absent, every send returns a permanent failure with a clear message and the
 * UI hides/disables the WhatsApp channel.
 */

import type {
  NotificationProvider,
  SendNotificationData,
  SendTemplateData,
  SendNotificationResult,
  DeliveryStatus,
} from "./provider-interface"
import {
  sendTextMessage,
  sendTemplateMessage,
  isWhatsAppConfigured,
} from "./whatsapp-api"

export class WhatsAppProvider implements NotificationProvider {
  readonly providerType = "whatsapp" as const

  async send(data: SendNotificationData): Promise<SendNotificationResult> {
    if (!isWhatsAppConfigured()) {
      return {
        success: false,
        error: "WhatsApp Business API not configured",
        permanentFailure: true,
      }
    }

    const result = await sendTextMessage(data.to, data.content)
    return {
      success: result.success,
      messageId: result.messageId,
      status: result.status,
      error: result.error,
      permanentFailure: result.permanentFailure,
    }
  }

  async sendTemplate(data: SendTemplateData): Promise<SendNotificationResult> {
    if (!isWhatsAppConfigured()) {
      return {
        success: false,
        error: "WhatsApp Business API not configured",
        permanentFailure: true,
      }
    }

    const result = await sendTemplateMessage(
      data.to,
      data.templateName,
      data.variables
    )
    return {
      success: result.success,
      messageId: result.messageId,
      status: result.status,
      error: result.error,
      permanentFailure: result.permanentFailure,
    }
  }

  /**
   * Real delivery status arrives via the Meta webhook
   * (app/api/webhooks/whatsapp) — polling is not supported by the Cloud API.
   */
  async getStatus(_messageId: string): Promise<DeliveryStatus> {
    return { status: "sent" }
  }
}

export const whatsappProvider = new WhatsAppProvider()
