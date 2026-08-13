/**
 * Facts the app can work out for itself.
 *
 * A GSTIN already contains the holder's PAN and their state; a PAN already
 * encodes the constitution of the entity. The validators decoded all of it and
 * then threw it away, leaving the forms to ask for the same information two and
 * three times over — and every re-entry is a chance to mistype something that
 * ends up printed on a tax invoice.
 *
 * The rule everywhere here: derive into EMPTY fields only. A value someone
 * typed is a decision, and a derivation must never overwrite one. That also
 * keeps the genuinely odd cases workable — a GSTIN and PAN can legitimately
 * disagree during a restructuring, and the cross-check warns about it rather
 * than this silently "fixing" it.
 */

import {
  GST_STATE_CODES,
  PAN_ENTITY_TYPES,
  normalizeGSTIN,
  normalizePAN,
  validateGSTIN,
} from "@/lib/india/validators"

/** PAN embedded in characters 3–12 of a valid GSTIN. */
export function panFromGstin(gstin: string | null | undefined): string | null {
  const result = validateGSTIN(gstin)
  return result.valid ? result.pan : null
}

/**
 * GST state code from the first two characters.
 *
 * Deliberately does not require the whole GSTIN to be valid: the state is
 * readable from the first two digits long before the check digit can be, and a
 * client mid-registration may hold a provisional number.
 */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const code = normalizeGSTIN(gstin).slice(0, 2)
  if (code.length !== 2 || !GST_STATE_CODES[code]) return null
  return code
}

export function stateNameFromGstin(gstin: string | null | undefined): string | null {
  const code = stateCodeFromGstin(gstin)
  return code ? GST_STATE_CODES[code] : null
}

/**
 * Entity constitution from the 4th character of a PAN, mapped onto the app's
 * own client-type codes.
 *
 * PAN distinguishes several things the client-type list does not (BOI, local
 * authority, artificial juridical person), and the app's list distinguishes
 * things PAN does not — a Pvt Ltd and a Public Ltd are both "C". Only the
 * unambiguous ones are derived; the rest are left for the user to pick, which
 * is the honest answer rather than a confident wrong one.
 */
const PAN_TO_CLIENT_TYPE: Record<string, string> = {
  H: "HUF",
  T: "TRUST",
  A: "AOP",
  // Everything else is genuinely ambiguous against this app's list and is left
  // for the user, with the PAN's own reading shown as a hint:
  //   C  any company — Pvt Ltd, Public Ltd, Section 8 or OPC
  //   F  a partnership firm or an LLP
  //   P  an individual OR a sole proprietorship, which use the proprietor's
  //      own PAN. They file different returns and hit different audit
  //      thresholds, so guessing one would be worse than leaving it blank.
  //   B, L, J, G  have no equivalent in the client-type list at all
}

export function clientTypeFromPan(pan: string | null | undefined): string | null {
  const normalized = normalizePAN(pan)
  if (normalized.length !== 10) return null
  const code = normalized[3]
  if (!PAN_ENTITY_TYPES[code]) return null
  return PAN_TO_CLIENT_TYPE[code] ?? null
}

/** What PAN says the entity is, in words — shown even when it can't be mapped. */
export function entityTypeLabelFromPan(pan: string | null | undefined): string | null {
  const normalized = normalizePAN(pan)
  if (normalized.length !== 10) return null
  return PAN_ENTITY_TYPES[normalized[3]] ?? null
}

export type DerivedClientFields = {
  pan?: string
  stateCode?: string
  clientType?: string
}

/**
 * Everything derivable from what has been entered so far, filtered to fields
 * that are currently empty.
 *
 * One function so the Add and Edit forms cannot drift apart on the rules.
 */
export function deriveClientFields(current: {
  gstin?: string | null
  pan?: string | null
  stateCode?: string | null
  clientType?: string | null
}): DerivedClientFields {
  const out: DerivedClientFields = {}

  const hasPan = Boolean(current.pan?.trim())
  const hasState = Boolean(current.stateCode?.trim())
  const hasType = Boolean(current.clientType?.trim())

  if (!hasPan) {
    const pan = panFromGstin(current.gstin)
    if (pan) out.pan = pan
  }

  if (!hasState) {
    const state = stateCodeFromGstin(current.gstin)
    if (state) out.stateCode = state
  }

  if (!hasType) {
    // Derive from whatever PAN we now have — the one just derived from the
    // GSTIN counts, so entering only a GSTIN still fills the constitution.
    const type = clientTypeFromPan(current.pan?.trim() || out.pan)
    if (type) out.clientType = type
  }

  return out
}
