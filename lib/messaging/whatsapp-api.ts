/**
 * WhatsApp Business API Integration (Meta Cloud API)
 *
 * Requires env vars:
 *   WHATSAPP_API_TOKEN       — Meta permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID — Sending phone number ID from Meta Business
 *
 * When those vars are absent every call returns { success: false, error: "WhatsApp not configured" }
 * so callers degrade gracefully and the UI can surface the banner already in whatsapp-chat.tsx.
 */

const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_API_BASE = "https://graph.facebook.com/v19.0"

export interface SendTextMessageResult {
  success: boolean
  messageId?: string
  status?: string
  error?: string
}

function notConfigured(): SendTextMessageResult {
  return { success: false, error: "WhatsApp Business API not configured" }
}

/**
 * Send a plain-text message via WhatsApp Cloud API.
 */
export async function sendTextMessage(
  phoneNumber: string,
  content: string
): Promise<SendTextMessageResult> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return notConfigured()

  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber.replace(/\D/g, ""),
          type: "text",
          text: { body: content },
        }),
      }
    )

    const json = await response.json()

    if (!response.ok) {
      const errMsg = json?.error?.message ?? `HTTP ${response.status}`
      return { success: false, error: errMsg }
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
 * Send a pre-approved template message via WhatsApp Cloud API.
 */
export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  variables: Record<string, string>
): Promise<SendTextMessageResult> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return notConfigured()

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

  try {
    const response = await fetch(
      `${WHATSAPP_API_BASE}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber.replace(/\D/g, ""),
          type: "template",
          template: { name: templateName, language: { code: "en" }, components },
        }),
      }
    )

    const json = await response.json()

    if (!response.ok) {
      const errMsg = json?.error?.message ?? `HTTP ${response.status}`
      return { success: false, error: errMsg }
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
 * Check message delivery status via WhatsApp Cloud API webhook data.
 * The Cloud API pushes status updates via webhooks — polling is not supported.
 * Returns "sent" as a safe default; integrate webhooks to get real delivery status.
 */
export async function getMessageStatus(_messageId: string): Promise<{
  status: "sent" | "delivered" | "read" | "failed"
  timestamp?: Date
}> {
  return { status: "sent", timestamp: new Date() }
}
