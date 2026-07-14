import { getFirmSettings } from "@/lib/firm-settings"
import { renderPlainTextEmail } from "@/lib/messaging/email-html"
import { notificationService } from "@/lib/messaging/notification-service"

/**
 * Best-effort "welcome / onboarding successful" email to a newly-added client.
 *
 * Fired right after a client record is created. It NEVER throws — a mail
 * failure (unset RESEND_API_KEY, unverified domain, transient error) must not
 * break client creation. Skipped entirely when the client has no email.
 *
 * The firm name/branding come from the tenant-scoped firm settings, so this
 * must run inside an authenticated request (both create paths are guarded).
 */
export async function sendClientWelcomeEmail(client: {
  name: string
  email: string | null | undefined
}): Promise<void> {
  if (!client.email) return
  try {
    const cfg = await getFirmSettings()
    const firstName = client.name.trim().split(/\s+/)[0] || "there"
    const content =
      `Dear ${firstName},\n\n` +
      `Welcome to ${cfg.firmName}! Your onboarding is complete and your ` +
      `account has been set up successfully.\n\n` +
      `Our team will be in touch about the services we'll be handling for you, ` +
      `and about any documents we still need. If you have any questions in the ` +
      `meantime, just reply to this email.\n\n` +
      `We're glad to have you on board.\n\n` +
      `Warm regards,\n${cfg.firmName}`

    await notificationService.send({
      channel: "email",
      to: client.email,
      subject: `Onboarding successful — Welcome to ${cfg.firmName}`,
      content: renderPlainTextEmail({
        content,
        firmName: cfg.firmName,
        firmPhone: cfg.firmPhone,
        replyToEmail: cfg.replyToEmail,
      }),
    })
  } catch (err) {
    console.error("welcome email failed:", err)
  }
}
