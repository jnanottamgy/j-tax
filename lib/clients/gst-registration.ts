/**
 * Is this client registered under GST — and if not, does anyone know?
 *
 * A blank `Client.gstin` used to mean two completely different things:
 *
 *   1. the client is not registered under GST, so a B2C invoice carrying no
 *      recipient GSTIN is exactly right; or
 *   2. nobody has asked them for it yet.
 *
 * The invoice came out identical either way, because the GST split falls back
 * to the firm's own state and computes happily without the recipient. Only the
 * second case is wrong, and it is wrong in a way the firm does not find out
 * about: a tax invoice with no recipient GSTIN cannot support the client's
 * input-credit claim, so the GST on it turns into their cost instead of their
 * credit. They discover it at reconciliation, months later, and the invoice has
 * long since been issued and reported.
 *
 * Recording "not registered" as a deliberate answer is what separates the two.
 * Once the answer exists, the app can stay quiet about genuine B2C clients and
 * speak up about the ones whose GSTIN is simply missing.
 *
 * Pure: no database, no side effects.
 */

export type GstRegistrationStatus = "REGISTERED" | "UNREGISTERED" | "UNKNOWN"

/** The value stored in `Client.gstRegistration` to mean "asked, and they are not registered". */
export const GST_UNREGISTERED = "UNREGISTERED"

export type GstRegistrationResolution = {
  status: GstRegistrationStatus
  /** For the client record — what a reader should understand at a glance. */
  label: string
  /** Where the answer came from, so the UI can explain itself. */
  reason: string
}

/**
 * A GSTIN on the record settles it: only a registered person has one. Absent
 * that, an explicit "not registered" is an answer; anything else is a gap.
 */
export function resolveGstRegistration(client: {
  gstin?: string | null
  gstRegistration?: string | null
}): GstRegistrationResolution {
  if (client.gstin && client.gstin.trim()) {
    return {
      status: "REGISTERED",
      label: "GST registered",
      reason: "A GSTIN is on the client record.",
    }
  }

  if ((client.gstRegistration ?? "").trim().toUpperCase() === GST_UNREGISTERED) {
    return {
      status: "UNREGISTERED",
      label: "Not GST registered",
      reason: "Recorded as unregistered — invoices to this client are B2C and carry no recipient GSTIN.",
    }
  }

  return {
    status: "UNKNOWN",
    label: "GSTIN not on record",
    reason: "No GSTIN, and nobody has recorded whether this client is registered.",
  }
}

export type InvoiceGstinWarning = {
  headline: string
  /** What it costs the client — the reason this is worth interrupting for. */
  consequence: string
}

/**
 * Should raising this invoice stop and ask about the recipient's GSTIN?
 *
 * Only when GST is actually being charged. A zero-rated or nil-tax invoice
 * gives the recipient nothing to claim, so the GSTIN changes nothing and the
 * warning would be noise.
 *
 * This warns; it never blocks. A firm legitimately needs to issue an invoice
 * to a client whose registration it has not confirmed yet, and a hard block
 * would just teach people to put a junk GSTIN in the field.
 */
export function invoiceGstinWarning(input: {
  gstin?: string | null
  gstRegistration?: string | null
  /** GST being charged on this invoice, in rupees. */
  taxAmount: number
}): InvoiceGstinWarning | null {
  if (!(input.taxAmount > 0)) return null

  const { status } = resolveGstRegistration(input)
  if (status !== "UNKNOWN") return null

  return {
    headline: "No GSTIN on record for this client.",
    consequence:
      "The invoice will go out with a blank recipient GSTIN, so the client cannot claim input credit on the GST charged. Add their GSTIN, or record that they are not registered.",
  }
}

/**
 * Was the place of supply a real answer, or the firm's own state standing in?
 *
 * `resolveGstFields` falls back to the firm's state when the client has neither
 * a state code nor a GSTIN. That fallback is reasonable — most clients are
 * local — but it silently produces CGST + SGST, and for an out-of-state client
 * the whole invoice is then taxed under the wrong heads. Worth saying out loud
 * at the point of issue, where it is still free to correct.
 */
export function placeOfSupplyIsAssumed(client: {
  gstin?: string | null
  stateCode?: string | null
}): boolean {
  return !(client.stateCode && client.stateCode.trim()) && !(client.gstin && client.gstin.trim())
}
