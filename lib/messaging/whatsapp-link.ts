/**
 * WhatsApp click-to-chat links.
 *
 * WHY LINKS AND NOT THE CLOUD API
 * The Meta Cloud API needs a Business account, a verified number, per-template
 * pre-approval before you may message anyone, and a per-conversation fee. For a
 * practice that just wants to nudge a client about a filing, that is a lot of
 * ceremony — and until it is all in place nothing sends at all.
 *
 * A wa.me link needs none of it. We prepare the recipient and draft the text;
 * WhatsApp opens with the message ready and the user presses send. The message
 * then comes from the firm's own number, which is the number clients already
 * recognise and can reply to.
 *
 * Trade-off, stated plainly: sending is manual. There is no delivery receipt
 * and nothing can be sent unattended, so this cannot drive automated reminders
 * — those stay on email.
 */

/** India. Most numbers in a CA firm's book are local and stored without a code. */
const DEFAULT_COUNTRY_CODE = "91"

/** E.164 allows at most 15 digits including the country code; ITU minimum is 8. */
const MIN_MSISDN_DIGITS = 8
const MAX_MSISDN_DIGITS = 15

/**
 * Reduce whatever is on file to the digits WhatsApp expects: country code +
 * subscriber number, no `+`, spaces, or punctuation.
 *
 * Numbers reach us in every shape a human might type — "+91 98765 43210",
 * "098765-43210", "9876543210", "91 98765 43210". Getting this wrong opens a
 * chat with the wrong person or a dead one, so each case is handled explicitly
 * rather than by stripping non-digits and hoping.
 *
 * Returns null when the value cannot be a real number; callers should treat
 * that as "no WhatsApp for this contact" rather than guessing.
 */
export function normalizeWhatsAppNumber(
  raw: string | null | undefined,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  // An explicit `+` means the country code is already present — never re-add one.
  const hadPlus = trimmed.startsWith("+")
  let digits = trimmed.replace(/\D/g, "")
  if (!digits) return null

  if (!hadPlus) {
    // Indian STD/trunk prefix: 0 before a 10-digit mobile. Not part of the
    // international number.
    if (digits.length === 11 && digits.startsWith("0")) {
      digits = digits.slice(1)
    }
    // 00 is the international access prefix in India (00 91 …).
    else if (digits.length > 12 && digits.startsWith("00")) {
      digits = digits.slice(2)
    }

    // A bare 10-digit number is local — attach the default country code.
    // Indian mobiles start 6-9; landlines are not on WhatsApp.
    if (digits.length === 10) {
      if (defaultCountryCode === DEFAULT_COUNTRY_CODE && !/^[6-9]/.test(digits)) {
        return null
      }
      digits = `${defaultCountryCode}${digits}`
    }
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2)
  }

  if (digits.length < MIN_MSISDN_DIGITS || digits.length > MAX_MSISDN_DIGITS) {
    return null
  }

  // Reject an Indian country code followed by something that is not a mobile.
  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length === 12) {
    if (!/^[6-9]/.test(digits.slice(2))) return null
  }

  return digits
}

/** Whether a chat can be opened for this value. */
export function canWhatsApp(raw: string | null | undefined): boolean {
  return normalizeWhatsAppNumber(raw) !== null
}

/**
 * Pick the number to message. The dedicated WhatsApp field wins; otherwise fall
 * back to the phone on file, which for most clients is the same number.
 */
export function resolveWhatsAppNumber(contact: {
  whatsapp?: string | null
  phone?: string | null
  phoneNumber?: string | null
}): string | null {
  return (
    normalizeWhatsAppNumber(contact.whatsapp) ??
    normalizeWhatsAppNumber(contact.phone) ??
    normalizeWhatsAppNumber(contact.phoneNumber)
  )
}

/**
 * Build the click-to-chat URL.
 *
 * wa.me is the officially documented entry point and routes itself: the mobile
 * app on a phone, WhatsApp Web or the desktop app otherwise. Hard-coding
 * web.whatsapp.com would break every phone user.
 *
 * Returns null when the number is unusable, so a caller cannot accidentally
 * open a broken chat.
 */
export function buildWhatsAppUrl(
  rawNumber: string | null | undefined,
  message?: string | null
): string | null {
  const number = normalizeWhatsAppNumber(rawNumber)
  if (!number) return null

  const base = `https://wa.me/${number}`
  const text = message?.trim()
  if (!text) return base

  // encodeURIComponent keeps newlines (%0A), which WhatsApp renders as real
  // line breaks — drafts stay readable instead of collapsing to one line.
  return `${base}?text=${encodeURIComponent(text)}`
}

/** Pretty form for display, e.g. "+91 98765 43210". */
export function formatWhatsAppNumber(raw: string | null | undefined): string | null {
  const digits = normalizeWhatsAppNumber(raw)
  if (!digits) return null

  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length === 12) {
    const local = digits.slice(2)
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`
  }
  return `+${digits}`
}
