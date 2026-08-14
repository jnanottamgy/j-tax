/**
 * Can the firm actually reach this client?
 *
 * Every automated message the app sends to a client goes by email: the welcome
 * mail, the compliance deadline reminder, the invoice reminder, the portal
 * invitation. Each of those send sites guards with `if (!client.email)` and
 * moves on, which is the right thing to do — a cron run must not die on one bad
 * row. The problem is that nothing happened next. The reminder that was
 * supposed to go out seven days before a GST deadline simply did not, no one
 * was told, and the first sign of trouble was a late fee.
 *
 * WhatsApp does not close the gap. It is env-gated behind an approved template
 * and only ever sent as a copy of an email that already went, so a client with
 * a phone number and no email address still receives nothing at all.
 *
 * This is offline arithmetic over three columns. It exists so the same
 * definition of "uncontactable" is used by the badge on the client record, the
 * banner that lists the affected clients, and the cron that skips them.
 */

export type ContactChannel = "email" | "phone"

export type ClientReachability = {
  /** Automated mail can go out — reminders, invoices, portal invitations. */
  canEmail: boolean
  /** A WhatsApp copy can ride along, where the firm has it enabled. */
  canWhatsApp: boolean
  /** Somebody can pick up the phone. */
  canCall: boolean
  /** Any channel at all, automated or human. */
  isReachable: boolean
  /** Channels the firm does not hold, in the order worth chasing them. */
  missing: ContactChannel[]
  /**
   * What the firm loses, in one line — null when nothing is missing.
   * Phrased as consequence, not as a scolding: the point is that work will
   * silently not happen, not that a field is empty.
   */
  gap: string | null
}

const filled = (v: string | null | undefined): boolean => Boolean(v && v.trim())

export function clientReachability(client: {
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
}): ClientReachability {
  const canEmail = filled(client.email)
  const canWhatsApp = filled(client.whatsapp)
  const canCall = canWhatsApp || filled(client.phone)

  const missing: ContactChannel[] = []
  if (!canEmail) missing.push("email")
  if (!canCall) missing.push("phone")

  let gap: string | null = null
  if (!canEmail && !canCall) {
    gap =
      "No email address and no phone number — this client cannot be contacted at all, by the app or by anyone in the firm."
  } else if (!canEmail) {
    gap =
      "No email address — deadline reminders, invoice reminders and portal invitations are skipped for this client. Someone has to chase them by hand."
  } else if (!canCall) {
    gap = "No phone number — there is no way to reach this client when email goes unanswered."
  }

  return {
    canEmail,
    canWhatsApp,
    canCall,
    isReachable: canEmail || canCall,
    missing,
    gap,
  }
}

/** Short label for the badge that sits next to a client's name. */
export function reachabilityBadgeLabel(r: ClientReachability): string | null {
  if (!r.isReachable) return "No contact details"
  if (!r.canEmail) return "No email"
  return null
}
