/**
 * Notification Provider Interface
 * 
 * This interface defines the contract for notification providers (Email, WhatsApp, SMS, etc.)
 * This allows the system to support multiple notification channels and easily switch between them.
 */

export interface NotificationProvider {
  /**
   * Send a notification
   */
  send(data: SendNotificationData): Promise<SendNotificationResult>
  
  /**
   * Send a template-based notification
   */
  sendTemplate(data: SendTemplateData): Promise<SendNotificationResult>
  
  /**
   * Check delivery status of a notification
   */
  getStatus(messageId: string): Promise<DeliveryStatus>
  
  /**
   * Provider type identifier
   */
  readonly providerType: "email" | "whatsapp" | "sms"
}

export interface SendNotificationData {
  to: string // Email address or phone number
  subject?: string // For email
  content: string // Plain text or HTML content
  variables?: Record<string, string> // Variables for substitution
  metadata?: Record<string, any> // Additional metadata
}

export interface SendTemplateData {
  to: string // Email address or phone number
  templateName: string // Template identifier
  variables: Record<string, string> // Template variables
  metadata?: Record<string, any> // Additional metadata
}

export interface SendNotificationResult {
  success: boolean
  messageId?: string
  status?: string
  error?: string
  providerResponse?: any // Raw response from provider
}

export interface DeliveryStatus {
  status: "sent" | "delivered" | "read" | "failed" | "bounced" | "complained"
  timestamp?: Date
  details?: Record<string, any>
}
