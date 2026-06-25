/**
 * Resend Email Provider
 *
 * Reads firm branding dynamically from the `firm_settings` DB row so emails
 * always reflect the PARTNER-configured firm name and sender address — no server
 * restart required after settings changes.
 *
 * Falls back to FIRM_NAME / FROM_EMAIL env vars when the DB row is absent.
 */

import type {
  NotificationProvider,
  SendNotificationData,
  SendTemplateData,
  SendNotificationResult,
  DeliveryStatus,
} from "./provider-interface"
import { getFirmSettings, resolveSenderEnvelope } from "@/lib/firm-settings"

const RESEND_API_URL = "https://api.resend.com/emails"
const RESEND_API_KEY = process.env.RESEND_API_KEY

export class ResendProvider implements NotificationProvider {
  readonly providerType = "email" as const

  private sanitizeContent(content: string): string {
    return content.replace(/[\r\n]/g, " ")
  }

  async send(data: SendNotificationData): Promise<SendNotificationResult> {
    try {
      if (!RESEND_API_KEY) {
        return { success: false, error: "Resend API key not configured" }
      }

      const cfg = await getFirmSettings()
      const envelope = resolveSenderEnvelope(cfg)

      if (!envelope.fromAddress) {
        return { success: false, error: envelope.reason }
      }

      const sanitizedSubject = this.sanitizeContent(
        data.subject || `Notification from ${cfg.firmName}`
      )

      const body: Record<string, unknown> = {
        from: envelope.fromAddress,
        to: [data.to],
        subject: sanitizedSubject,
        html: data.content,
      }
      if (envelope.replyTo) body.reply_to = envelope.replyTo
      const tags = [
        ...(data.metadata ? this.formatMetadata(data.metadata) : []),
        { name: "branding_mode", value: envelope.usingFallback ? "fallback" : "direct" },
      ]
      body.tags = tags

      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const responseData = await response.json()

      if (response.ok) {
        return {
          success: true,
          messageId: responseData.id,
          status: "sent",
          providerResponse: responseData,
        }
      }
      return {
        success: false,
        error: responseData.message || "Failed to send email",
        providerResponse: responseData,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async sendTemplate(data: SendTemplateData): Promise<SendNotificationResult> {
    try {
      if (!RESEND_API_KEY) {
        return { success: false, error: "Resend API key not configured" }
      }

      const cfg = await getFirmSettings()

      const template = this.getTemplate(data.templateName, cfg)
      if (!template) {
        return { success: false, error: `Template not found: ${data.templateName}` }
      }

      const htmlContent = this.substituteVariables(template.html, data.variables)
      const subject = this.substituteVariables(template.subject, data.variables)

      const envelope = resolveSenderEnvelope(cfg)
      if (!envelope.fromAddress) {
        return { success: false, error: envelope.reason }
      }

      const body: Record<string, unknown> = {
        from: envelope.fromAddress,
        to: [data.to],
        subject,
        html: htmlContent,
      }
      if (envelope.replyTo) body.reply_to = envelope.replyTo
      const tags = [
        ...(data.metadata ? this.formatMetadata(data.metadata) : []),
        { name: "branding_mode", value: envelope.usingFallback ? "fallback" : "direct" },
        { name: "template", value: data.templateName },
      ]
      body.tags = tags

      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const responseData = await response.json()

      if (response.ok) {
        return {
          success: true,
          messageId: responseData.id,
          status: "sent",
          providerResponse: responseData,
        }
      }
      return {
        success: false,
        error: responseData.message || "Failed to send template email",
        providerResponse: responseData,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async getStatus(messageId: string): Promise<DeliveryStatus> {
    try {
      if (!RESEND_API_KEY) throw new Error("Resend API key not configured")

      const response = await fetch(`${RESEND_API_URL}/${messageId}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      })

      const data = await response.json()

      if (response.ok) {
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
          details: { from: data.from, to: data.to, subject: data.subject },
        }
      }
      throw new Error(data.message || "Failed to get message status")
    } catch {
      return { status: "sent" }
    }
  }

  private substituteVariables(content: string, variables: Record<string, string>): string {
    let result = content
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), value)
    }
    return result
  }

  private formatMetadata(metadata: Record<string, unknown>): Array<{ name: string; value: string }> {
    return Object.entries(metadata).map(([key, value]) => ({
      name: key,
      value: String(value),
    }))
  }

  private getTemplate(
    templateName: string,
    cfg: Awaited<ReturnType<typeof getFirmSettings>>
  ): { subject: string; html: string } | null {
    const contactBits = [
      cfg.fromEmail ? `Email: ${cfg.fromEmail}` : "",
      cfg.firmPhone ? `Phone: ${cfg.firmPhone}` : "",
      cfg.website ? `Web: ${cfg.website}` : "",
    ].filter(Boolean).join(" &nbsp;|&nbsp; ")
    const replyHint = cfg.replyToEmail && cfg.replyToEmail !== cfg.fromEmail
      ? `<p style="font-size:12px;">Reply to: ${cfg.replyToEmail}</p>`
      : ""
    const footer = `
      <div style="text-align:center;margin-top:30px;color:#6b7280;font-size:14px;">
        <p><strong>${cfg.firmName}</strong></p>
        ${contactBits ? `<p>${contactBits}</p>` : ""}
        ${cfg.firmAddress ? `<p style="font-size:12px;">${cfg.firmAddress}</p>` : ""}
        ${replyHint}
      </div>`

    const header = (title: string) => `
      <div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);padding:30px;text-align:center;border-radius:10px 10px 0 0;">
        <h1 style="color:white;margin:0;font-size:28px;">${cfg.firmName}</h1>
        ${title ? `<p style="color:#bfdbfe;margin:8px 0 0;font-size:16px;">${title}</p>` : ""}
      </div>`

    const wrap = (inner: string) => `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
      <style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;}
      .container{max-width:600px;margin:0 auto;padding:20px;}
      .content{background:#f9fafb;padding:30px;border-radius:0 0 10px 10px;}
      .box{background:white;padding:20px;border-radius:8px;margin:20px 0;}
      .btn{display:inline-block;background:#3b82f6;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;margin-top:20px;}
      </style></head><body><div class="container">${inner}</div></body></html>`

    const templates: Record<string, { subject: string; html: string }> = {
      payment_reminder: {
        subject: `Payment Reminder — ${cfg.firmName}`,
        html: wrap(`${header("Payment Reminder")}<div class="content">
          <p>Dear {{client_name}},</p>
          <p>This is a friendly reminder that your payment for <strong>Invoice #{{invoice_number}}</strong> is due.</p>
          <div class="box" style="border-left:4px solid #3b82f6;">
            <p><strong>Invoice Number:</strong> #{{invoice_number}}</p>
            <p><strong>Amount Due:</strong> ₹{{amount}}</p>
            <p><strong>Due Date:</strong> {{due_date}}</p>
            <p><strong>Days Overdue:</strong> {{days_overdue}}</p>
          </div>
          <p>Please make the payment at your earliest convenience to avoid any late fees.</p>
          <a href="{{payment_link}}" class="btn">Pay Now</a>
          <p>If you have already made the payment, please disregard this notice.</p>
          <p>Thank you for your business.</p>${footer}</div>`),
      },
      compliance_reminder: {
        subject: `Compliance Reminder — ${cfg.firmName}`,
        html: wrap(`${header("Compliance Reminder")}<div class="content">
          <p>Dear {{client_name}},</p>
          <p style="color:#ef4444;font-weight:bold;">URGENT: Compliance Deadline Approaching</p>
          <div class="box" style="border-left:4px solid #ef4444;">
            <p><strong>Compliance Type:</strong> {{compliance_type}}</p>
            <p><strong>Due Date:</strong> {{due_date}}</p>
            <p><strong>Days Until Due:</strong> {{days_until_due}}</p>
          </div>
          <p>Please ensure all required documents and filings are completed before the deadline to avoid penalties.</p>
          <p>If you need any assistance, please contact our team.</p>${footer}</div>`),
      },
      document_request: {
        subject: `Document Request — ${cfg.firmName}`,
        html: wrap(`${header("Document Request")}<div class="content">
          <p>Dear {{client_name}},</p>
          <p>We require the following documents to proceed with your <strong>{{service_type}}</strong>:</p>
          <div class="box" style="border-left:4px solid #10b981;">
            <ul style="list-style:none;padding:0;margin:0;">
              <li style="padding:8px 0;border-bottom:1px solid #e5e7eb;">{{document_1}}</li>
              <li style="padding:8px 0;border-bottom:1px solid #e5e7eb;">{{document_2}}</li>
              <li style="padding:8px 0;">{{document_3}}</li>
            </ul>
          </div>
          <p>Please upload these documents through your client portal or send them to us at your earliest convenience.</p>${footer}</div>`),
      },
      task_notification: {
        subject: `Task Assigned — ${cfg.firmName}`,
        html: wrap(`${header("Task Assignment")}<div class="content">
          <p>Dear {{recipient_name}},</p>
          <p>You have been assigned a new task:</p>
          <div class="box" style="border-left:4px solid #8b5cf6;">
            <p><strong>Task:</strong> {{task_title}}</p>
            <p><strong>Client:</strong> {{client_name}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
            <p><strong>Due Date:</strong> {{due_date}}</p>
            <p><strong>Description:</strong> {{description}}</p>
          </div>
          <p>Please complete this task by the due date. If you need assistance, contact your manager.</p>${footer}</div>`),
      },
    }

    return templates[templateName] ?? null
  }
}

export const resendProvider = new ResendProvider()
