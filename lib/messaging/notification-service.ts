/**
 * Notification Service
 * 
 * This service provides a unified interface for sending notifications across different providers.
 * It abstracts the provider details and provides a simple API for the application.
 */

import type { NotificationProvider } from "./provider-interface"
import { resendProvider } from "./resend-provider"

export type NotificationChannel = "email" | "whatsapp" | "sms"

export interface SendNotificationOptions {
  channel: NotificationChannel
  to: string
  subject?: string
  content?: string
  templateName?: string
  variables?: Record<string, string>
  metadata?: Record<string, any>
}

export interface NotificationResult {
  success: boolean
  messageId?: string
  status?: string
  error?: string
  providerResponse?: any
}

/**
 * Notification Service class
 */
class NotificationService {
  private providers: Map<NotificationChannel, NotificationProvider> = new Map()

  constructor() {
    // Register default providers
    this.registerProvider("email", resendProvider)
  }

  /**
   * Register a notification provider
   */
  registerProvider(channel: NotificationChannel, provider: NotificationProvider): void {
    this.providers.set(channel, provider)
  }

  /**
   * Get a provider by channel
   */
  private getProvider(channel: NotificationChannel): NotificationProvider {
    const provider = this.providers.get(channel)
    if (!provider) {
      throw new Error(`No provider registered for channel: ${channel}`)
    }
    return provider
  }

  /**
   * Send a notification with retry logic
   */
  async send(options: SendNotificationOptions, maxRetries: number = 3): Promise<NotificationResult> {
    const provider = this.getProvider(options.channel)
    let lastError: string | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (options.templateName) {
        // Send template-based notification
        const result = await provider.sendTemplate({
          to: options.to,
          templateName: options.templateName,
          variables: options.variables || {},
          metadata: { ...options.metadata, attempt: attempt + 1 },
        })

        if (result.success) {
          return {
            success: true,
            messageId: result.messageId,
            status: result.status,
            providerResponse: result.providerResponse,
          }
        }
        lastError = result.error
      } else {
        // Send regular notification
        if (!options.content) {
          return {
            success: false,
            error: "Content is required when not using a template",
          }
        }

        const result = await provider.send({
          to: options.to,
          subject: options.subject,
          content: options.content,
          variables: options.variables,
          metadata: { ...options.metadata, attempt: attempt + 1 },
        })

        if (result.success) {
          return {
            success: true,
            messageId: result.messageId,
            status: result.status,
            providerResponse: result.providerResponse,
          }
        }
        lastError = result.error
      }

      // If not the last attempt, wait before retrying with exponential backoff
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries failed
    return {
      success: false,
      error: lastError || "Failed to send notification after retries",
    }
  }

  /**
   * Send a payment reminder
   */
  async sendPaymentReminder(data: {
    to: string
    clientName: string
    invoiceNumber: string
    amount: string
    dueDate: string
    daysOverdue: number
    paymentLink?: string
  }): Promise<NotificationResult> {
    return this.send({
      channel: "email",
      to: data.to,
      templateName: "payment_reminder",
      variables: {
        client_name: data.clientName,
        invoice_number: data.invoiceNumber,
        amount: data.amount,
        due_date: data.dueDate,
        days_overdue: String(data.daysOverdue),
        payment_link: data.paymentLink || "#",
      },
      metadata: {
        type: "payment_reminder",
        invoice_number: data.invoiceNumber,
      },
    })
  }

  /**
   * Send a compliance reminder
   */
  async sendComplianceReminder(data: {
    to: string
    clientName: string
    complianceType: string
    dueDate: string
    daysUntilDue: number
  }): Promise<NotificationResult> {
    return this.send({
      channel: "email",
      to: data.to,
      templateName: "compliance_reminder",
      variables: {
        client_name: data.clientName,
        compliance_type: data.complianceType,
        due_date: data.dueDate,
        days_until_due: String(data.daysUntilDue),
      },
      metadata: {
        type: "compliance_reminder",
        compliance_type: data.complianceType,
      },
    })
  }

  /**
   * Send a document request
   */
  async sendDocumentRequest(data: {
    to: string
    clientName: string
    serviceType: string
    documents: string[]
  }): Promise<NotificationResult> {
    return this.send({
      channel: "email",
      to: data.to,
      templateName: "document_request",
      variables: {
        client_name: data.clientName,
        service_type: data.serviceType,
        document_1: data.documents[0] || "N/A",
        document_2: data.documents[1] || "N/A",
        document_3: data.documents[2] || "N/A",
      },
      metadata: {
        type: "document_request",
        service_type: data.serviceType,
      },
    })
  }

  /**
   * Send a task notification
   */
  async sendTaskNotification(data: {
    to: string
    recipientName: string
    taskTitle: string
    clientName: string
    priority: string
    dueDate: string
    description: string
  }): Promise<NotificationResult> {
    return this.send({
      channel: "email",
      to: data.to,
      templateName: "task_notification",
      variables: {
        recipient_name: data.recipientName,
        task_title: data.taskTitle,
        client_name: data.clientName,
        priority: data.priority,
        due_date: data.dueDate,
        description: data.description,
      },
      metadata: {
        type: "task_notification",
        task_title: data.taskTitle,
      },
    })
  }

  /**
   * Check delivery status
   */
  async getStatus(channel: NotificationChannel, messageId: string) {
    const provider = this.getProvider(channel)
    return provider.getStatus(messageId)
  }
}

// Export singleton instance
export const notificationService = new NotificationService()
