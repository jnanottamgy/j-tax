/**
 * Hand-off links that open a mail client with the message already drafted.
 *
 * WHY THIS EXISTS ALONGSIDE THE PROVIDER
 * Sending through Resend needs an API key and a verified sending domain. Until
 * both are in place nothing leaves the building, and the failure is quiet — the
 * quotation is marked Sent, the email history says FAILED, and the client is
 * still waiting. That is a bad place for a practice to be on a deadline.
 *
 * This is the same trade the WhatsApp links make: we prepare the recipient,
 * subject and body, the person presses send. It goes from their own mailbox, so
 * it arrives from an address the client recognises and can reply to, and it
 * needs no DNS, no domain verification and no provider.
 *
 * WHAT IT CANNOT DO — ATTACHMENTS
 * No compose URL can attach a file. A web page that could put an arbitrary file
 * into your outgoing mail would be a security hole, so every browser and every
 * webmail client refuses it, and no parameter exists for it in Gmail's compose
 * URL. Attaching a PDF means downloading it and adding it by hand.
 *
 * For a quotation that is rarely what you want anyway: the client link shows the
 * live quotation, lets them accept or decline without a login, and marks the
 * quotation Viewed when they open it. A PDF does none of that.
 */

/** Gmail silently drops very long compose URLs, and browsers cap them too. */
const MAX_URL_LENGTH = 1900

export type MailDraft = {
  to: string
  subject: string
  body: string
  cc?: string | null
  bcc?: string | null
}

function trimToFit(url: string, body: string, buildWith: (b: string) => string): string {
  if (url.length <= MAX_URL_LENGTH) return url
  // Cut the body rather than the recipient or subject — losing the address or
  // the subject line breaks the draft, losing the tail of the message does not.
  const overshoot = url.length - MAX_URL_LENGTH
  // Encoded characters cost more than one byte each, so cut generously and
  // re-measure rather than assuming a 1:1 relationship.
  let candidate = body.slice(0, Math.max(0, body.length - overshoot))
  let next = buildWith(candidate)
  while (next.length > MAX_URL_LENGTH && candidate.length > 0) {
    candidate = candidate.slice(0, Math.max(0, candidate.length - 200))
    next = buildWith(candidate)
  }
  return next
}

/**
 * Gmail's compose window in a browser tab.
 *
 * `view=cm` opens a compose window, `fs=1` makes it full-screen rather than a
 * corner popup, and `tf=1` keeps it in the current Gmail session — which is
 * what makes it land in the right account for someone signed into several.
 *
 * Returns null without a recipient, so a caller cannot open an empty compose
 * window and think it worked.
 */
export function buildGmailComposeUrl(draft: MailDraft): string | null {
  const to = draft.to?.trim()
  if (!to) return null

  const build = (body: string) => {
    const params = new URLSearchParams({ view: "cm", fs: "1", tf: "1", to })
    if (draft.subject?.trim()) params.set("su", draft.subject.trim())
    if (body) params.set("body", body)
    if (draft.cc?.trim()) params.set("cc", draft.cc.trim())
    if (draft.bcc?.trim()) params.set("bcc", draft.bcc.trim())
    return `https://mail.google.com/mail/?${params.toString()}`
  }

  return trimToFit(build(draft.body ?? ""), draft.body ?? "", build)
}

/**
 * The same draft for whoever does not use Gmail — opens Outlook, Mail, or
 * whatever the machine is set to.
 */
export function buildMailtoUrl(draft: MailDraft): string | null {
  const to = draft.to?.trim()
  if (!to) return null

  const build = (body: string) => {
    const params = new URLSearchParams()
    if (draft.subject?.trim()) params.set("subject", draft.subject.trim())
    if (body) params.set("body", body)
    if (draft.cc?.trim()) params.set("cc", draft.cc.trim())
    if (draft.bcc?.trim()) params.set("bcc", draft.bcc.trim())
    const qs = params.toString()
    return `mailto:${encodeURIComponent(to)}${qs ? `?${qs}` : ""}`
  }

  return trimToFit(build(draft.body ?? ""), draft.body ?? "", build)
}

/**
 * The covering note for a quotation.
 *
 * Plain text on purpose — a compose URL carries no formatting, and a draft that
 * arrives full of stray markup is one the sender has to tidy before sending,
 * which defeats the point.
 */
export function draftQuotationEmail(input: {
  clientName: string
  quotationNumber: string
  firmName: string
  /** Omitted, or the same as the firm, signs off with the firm alone. */
  senderName?: string | null
  publicUrl: string
  total?: number | null
  validUntil?: Date | string | null
}): { subject: string; body: string } {
  const validUntil = input.validUntil
    ? new Date(input.validUntil).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null

  const amount =
    typeof input.total === "number"
      ? `₹${input.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
      : null

  const lines = [
    `Dear ${input.clientName},`,
    "",
    `Please find our quotation ${input.quotationNumber} for your consideration.`,
    "",
    ...(amount ? [`Total: ${amount}`] : []),
    ...(validUntil ? [`Valid until: ${validUntil}`] : []),
    ...(amount || validUntil ? [""] : []),
    "You can view the full quotation and accept or decline it here:",
    input.publicUrl,
    "",
    "Do let us know if you have any questions.",
    "",
    "Regards,",
    ...(input.senderName?.trim() && input.senderName.trim() !== input.firmName.trim()
      ? [input.senderName.trim()]
      : []),
    input.firmName,
  ]

  return {
    subject: `Quotation ${input.quotationNumber} from ${input.firmName}`,
    body: lines.join("\n"),
  }
}
