/**
 * Resend Email Provider Implementation
 * 
 * This provider implements the NotificationProvider interface for sending emails via Resend.
 * Resend is a transactional email service with excellent deliverability and developer experience.
 */

import type {
  NotificationProvider,
  SendNotificationData,
  SendTemplateData,
  SendNotificationResult,
  DeliveryStatus,
} from "./provider-interface"

const RESEND_API_URL = "https://api.resend.com/emails"
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || ""
const FIRM_NAME = process.env.FIRM_NAME || "Your Tax Firm"
const FIRM_PHONE = process.env.FIRM_PHONE || ""

export class ResendProvider implements NotificationProvider {
  readonly providerType = "email" as const

  /**
   * Sanitize content to prevent email injection
   */
  private sanitizeContent(content: string): string {
    // Remove newlines and carriage returns to prevent header injection
    return content.replace(/[\r\n]/g, ' ')
  }

  /**
   * Send an email notification
   */
  async send(data: SendNotificationData): Promise<SendNotificationResult> {
    try {
      if (!RESEND_API_KEY) {
        return {
          success: false,
          error: "Resend API key not configured",
        }
      }

      // Sanitize subject to prevent email injection
      const sanitizedSubject = this.sanitizeContent(data.subject || `Notification from ${FIRM_NAME}`)

      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [data.to],
          subject: sanitizedSubject,
          html: data.content,
          ...(data.metadata && { tags: this.formatMetadata(data.metadata) }),
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        return {
          success: true,
          messageId: responseData.id,
          status: "sent",
          providerResponse: responseData,
        }
      } else {
        return {
          success: false,
          error: responseData.message || "Failed to send email",
          providerResponse: responseData,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Send a template-based email notification
   */
  async sendTemplate(data: SendTemplateData): Promise<SendNotificationResult> {
    try {
      if (!RESEND_API_KEY) {
        return {
          success: false,
          error: "Resend API key not configured",
        }
      }

      // Get the HTML template
      const template = this.getTemplate(data.templateName)
      if (!template) {
        return {
          success: false,
          error: `Template not found: ${data.templateName}`,
        }
      }

      // Substitute variables
      const htmlContent = this.substituteVariables(template.html, data.variables)
      const subject = this.substituteVariables(template.subject, data.variables)

      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [data.to],
          subject,
          html: htmlContent,
          ...(data.metadata && { tags: this.formatMetadata(data.metadata) }),
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        return {
          success: true,
          messageId: responseData.id,
          status: "sent",
          providerResponse: responseData,
        }
      } else {
        return {
          success: false,
          error: responseData.message || "Failed to send template email",
          providerResponse: responseData,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Check delivery status of an email
   */
  async getStatus(messageId: string): Promise<DeliveryStatus> {
    try {
      if (!RESEND_API_KEY) {
        throw new Error("Resend API key not configured")
      }

      const response = await fetch(`${RESEND_API_URL}/${messageId}`, {
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
      })

      const data = await response.json()

      if (response.ok) {
        // Map Resend status to our status enum
        const statusMap: Record<string, DeliveryStatus["status"]> = {
          sent: "sent",
          delivered: "delivered",
          opened: "read",
          clicked: "read",
          bounced: "bounced",
          complained: "complained",
          failed: "failed",
        }

        return {
          status: statusMap[data.last_event?.toLowerCase()] || "sent",
          timestamp: data.created_at ? new Date(data.created_at) : undefined,
          details: {
            from: data.from,
            to: data.to,
            subject: data.subject,
          },
        }
      } else {
        throw new Error(data.message || "Failed to get message status")
      }
    } catch (_e) {
      // Return default status on error
      return {
        status: "sent",
      }
    }
  }

  /**
   * Substitute variables in template content
   */
  private substituteVariables(content: string, variables: Record<string, string>): string {
    let result = content
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), value)
    }
    return result
  }

  /**
   * Format metadata as Resend tags
   */
  private formatMetadata(metadata: Record<string, any>): Array<{ name: string; value: string }> {
    return Object.entries(metadata).map(([key, value]) => ({
      name: key,
      value: String(value),
    }))
  }

  /**
   * Get email template by name
   */
  private getTemplate(templateName: string): { subject: string; html: string } | null {
    const templates: Record<string, { subject: string; html: string }> = {
      payment_reminder: {
        subject: `Payment Reminder - ${FIRM_NAME}`,
        html: this.getPaymentReminderTemplate(),
      },
      compliance_reminder: {
        subject: `Compliance Reminder - ${FIRM_NAME}`,
        html: this.getComplianceReminderTemplate(),
      },
      document_request: {
        subject: `Document Request - ${FIRM_NAME}`,
        html: this.getDocumentRequestTemplate(),
      },
      task_notification: {
        subject: `Task Notification - ${FIRM_NAME}`,
        html: this.getTaskNotificationTemplate(),
      },
    }

    return templates[templateName] || null
  }

  /**
   * Payment Reminder Template
   */
  private getPaymentReminderTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
    .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
    .highlight { color: #1e3a8a; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${FIRM_NAME}</h1>
    </div>
    <div class="content">
      <p>Dear {{client_name}},</p>
      <p>This is a friendly reminder that your payment for <span class="highlight">Invoice #{{invoice_number}}</span> is due.</p>
      
      <div class="invoice-details">
        <p><strong>Invoice Number:</strong> #{{invoice_number}}</p>
        <p><strong>Amount Due:</strong> ₹{{amount}}</p>
        <p><strong>Due Date:</strong> {{due_date}}</p>
        <p><strong>Days Overdue:</strong> {{days_overdue}}</p>
      </div>
      
      <p>Please make the payment at your earliest convenience to avoid any late fees.</p>
      
      <a href="{{payment_link}}" class="cta-button">Pay Now</a>
      
      <p>If you have already made the payment, please disregard this notice.</p>
      
      <p>Thank you for your business.</p>
      
      <div class="footer">
        <p>${FIRM_NAME}</p>
        <p>Email: ${FROM_EMAIL}${FIRM_PHONE ? ` | Phone: ${FIRM_PHONE}` : ""}</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Compliance Reminder Template
   */
  private getComplianceReminderTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compliance Reminder</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .compliance-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
    .urgent { color: #ef4444; font-weight: bold; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${FIRM_NAME}</h1>
    </div>
    <div class="content">
      <p>Dear {{client_name}},</p>
      <p class="urgent">URGENT: Compliance Deadline Approaching</p>
      
      <div class="compliance-details">
        <p><strong>Compliance Type:</strong> {{compliance_type}}</p>
        <p><strong>Due Date:</strong> {{due_date}}</p>
        <p><strong>Days Until Due:</strong> {{days_until_due}}</p>
      </div>
      
      <p>Please ensure all required documents and filings are completed before the deadline to avoid penalties.</p>
      
      <p>If you need any assistance or have questions, please contact our team.</p>
      
      <div class="footer">
        <p>${FIRM_NAME}</p>
        <p>Email: ${FROM_EMAIL}${FIRM_PHONE ? ` | Phone: ${FIRM_PHONE}` : ""}</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Document Request Template
   */
  private getDocumentRequestTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Request</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .document-list { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .document-list ul { list-style: none; padding: 0; }
    .document-list li { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
    .document-list li:last-child { border-bottom: none; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${FIRM_NAME}</h1>
    </div>
    <div class="content">
      <p>Dear {{client_name}},</p>
      <p>We require the following documents to proceed with your {{service_type}}:</p>
      
      <div class="document-list">
        <ul>
          <li>{{document_1}}</li>
          <li>{{document_2}}</li>
          <li>{{document_3}}</li>
        </ul>
      </div>
      
      <p>Please upload these documents through your client portal or send them to us at your earliest convenience.</p>
      
      <p>If you have any questions about these requirements, please don't hesitate to reach out.</p>
      
      <div class="footer">
        <p>${FIRM_NAME}</p>
        <p>Email: ${FROM_EMAIL}${FIRM_PHONE ? ` | Phone: ${FIRM_PHONE}` : ""}</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Task Notification Template
   */
  private getTaskNotificationTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Notification</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
    .task-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${FIRM_NAME}</h1>
    </div>
    <div class="content">
      <p>Dear {{recipient_name}},</p>
      <p>You have been assigned a new task:</p>
      
      <div class="task-details">
        <p><strong>Task:</strong> {{task_title}}</p>
        <p><strong>Client:</strong> {{client_name}}</p>
        <p><strong>Priority:</strong> {{priority}}</p>
        <p><strong>Due Date:</strong> {{due_date}}</p>
        <p><strong>Description:</strong> {{description}}</p>
      </div>
      
      <p>Please complete this task by the due date. If you need any assistance, please contact your manager.</p>
      
      <div class="footer">
        <p>${FIRM_NAME}</p>
        <p>Email: ${FROM_EMAIL}${FIRM_PHONE ? ` | Phone: ${FIRM_PHONE}` : ""}</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim()
  }
}

// Export singleton instance
export const resendProvider = new ResendProvider()
