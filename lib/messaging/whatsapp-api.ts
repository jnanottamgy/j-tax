/**
 * WhatsApp Business API Integration (Meta Cloud API)
 *
 * Requires env vars:
 *   WHATSAPP_API_TOKEN       — Meta permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID — Sending phone number ID from Meta Business
 * Optional:
 *   WHATSAPP_API_VERSION     — Graph API version (default v21.0)
 *
 * When those vars are absent every call returns { success: false, error: "WhatsApp not configured" }
 * so callers degrade gracefully and the UI can surface a "not configured" banner.
 *
 * Delivery/read status arrives via webhook (app/api/webhooks/whatsapp) — the
 * Cloud API does not support polling message status.
 */

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0"
const WHATSAPP_API_BASE = `https://graph.facebook.com/${WHATSAPP_API_VERSION}`

export interface SendTextMessageResult {
  success: boolean
  messageId?: string
  status?: string
  error?: string
  /** True when Meta rejected the request permanently (invalid number, unapproved
   *  template, outside 24h window…) — retrying can never succeed. */
  permanentFailure?: boolean
}

/** True when both Cloud API credentials are present. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(WHATSAPP_API_TOKEN && WHATSAPP_PHONE_NUMBER_ID)
}

/**
 * Normalize an Indian phone number to E.164 digits for the Cloud API.
 * "98765 43210" → "919876543210"; keeps an existing country code intact.
 */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // Bare 10-digit Indian mobile → prefix country code 91
  if (digits.length === 10) return `91${digits}`
  // "0"-prefixed domestic format → strip the trunk zero, add 91
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`
  return digits
}

function notConfigured(): SendTextMessageResult {
  return { success: false, error: "WhatsApp Business API not configured" }
}

async function postMessage(body: Record<string, unknown>): Promise<SendTextMessageResult> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    )

    const json = await response.json()

    if (!response.ok) {
      const errMsg = json?.error?.message ?? `HTTP ${response.status}`
      return {
        success: false,
        error: errMsg,
        permanentFailure:
          response.status >= 400 && response.status < 500 && response.status !== 429,
      }
    }

    const messageId: string = json?.messages?.[0]?.id ?? ""
    return { success: true, messageId, status: "sent" }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Send a plain-text message via WhatsApp Cloud API.
 *
 * Note: Meta only delivers free-form text inside the 24-hour customer-service
 * window (i.e. after the client last messaged you). Business-initiated
 * messages outside that window must use a pre-approved template.
 */
export async function sendTextMessage(
  phoneNumber: string,
  content: string
): Promise<SendTextMessageResult> {
  if (!isWhatsAppConfigured()) return notConfigured()

  return postMessage({
    messaging_product: "whatsapp",
    to: toWhatsAppNumber(phoneNumber),
    type: "text",
    text: { body: content },
  })
}

/**
 * Send a pre-approved template message via WhatsApp Cloud API.
 */
export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  variables: Record<string, string>,
  languageCode: string = "en"
): Promise<SendTextMessageResult> {
  if (!isWhatsAppConfigured()) return notConfigured()

  const components =
    Object.keys(variables).length > 0
      ? [
          {
            type: "body",
            parameters: Object.values(variables).map((v) => ({
              type: "text",
              text: v,
            })),
          },
        ]
      : []

  return postMessage({
    messaging_product: "whatsapp",
    to: toWhatsAppNumber(phoneNumber),
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components },
  })
}

/**
 * Check message delivery status via WhatsApp Cloud API webhook data.
 * The Cloud API pushes status updates via webhooks — polling is not supported.
 * Returns "sent" as a safe default; the webhook route updates real statuses.
 */
export async function getMessageStatus(_messageId: string): Promise<{
  status: "sent" | "delivered" | "read" | "failed"
  timestamp?: Date
}> {
  return { status: "sent", timestamp: new Date() }
}
