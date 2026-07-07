/**
 * India statutory identifier validators — the real thing, not just regexes.
 *
 * GSTIN gets full mod-36 check-digit verification (the same Luhn-36 algorithm
 * the GST portal uses), embedded-PAN extraction, and state-code validation.
 * PAN/TAN/IFSC get structural validation plus semantic extraction (entity type,
 * deductor city). Everything is offline and dependency-free — paid "is it
 * active" API lookups can layer on top later without touching this module.
 *
 * All validators accept raw user input (whitespace, lowercase) and expose a
 * `normalize*` companion that returns the canonical uppercase form.
 */

const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// ─── GST state codes (first two GSTIN digits) ────────────────────────────────

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  // 25 was Daman & Diu before the 2020 merger; old GSTINs may still carry it.
  "25": "Daman & Diu (legacy)",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  // 28 was undivided Andhra Pradesh (pre-Telangana bifurcation).
  "28": "Andhra Pradesh (old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
}

// ─── GSTIN ───────────────────────────────────────────────────────────────────

const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/**
 * Compute the GSTIN check digit (15th character) for the first 14 characters
 * using the standard Luhn mod-36 algorithm.
 */
export function gstinCheckDigit(first14: string): string {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const value = BASE36.indexOf(first14[i])
    if (value === -1) throw new Error(`Invalid GSTIN character: ${first14[i]}`)
    const factor = i % 2 === 0 ? 1 : 2
    const product = value * factor
    sum += Math.floor(product / 36) + (product % 36)
  }
  return BASE36[(36 - (sum % 36)) % 36]
}

export function normalizeGSTIN(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, "").toUpperCase()
}

export type GstinValidation =
  | {
      valid: true
      gstin: string
      stateCode: string
      stateName: string
      /** PAN of the registered entity, embedded in chars 3–12 */
      pan: string
      /** Registration count within the state (13th char) */
      entityCode: string
    }
  | { valid: false; error: string }

/**
 * Full GSTIN validation: shape → state code → check digit.
 * Returns parsed components on success so callers can auto-fill state/PAN.
 */
export function validateGSTIN(input: string | null | undefined): GstinValidation {
  const gstin = normalizeGSTIN(input)
  if (gstin.length !== 15) {
    return { valid: false, error: "GSTIN must be exactly 15 characters" }
  }
  if (!GSTIN_SHAPE.test(gstin)) {
    return { valid: false, error: "GSTIN format is invalid (expected e.g. 27ABCDE1234F1Z5)" }
  }
  const stateCode = gstin.slice(0, 2)
  const stateName = GST_STATE_CODES[stateCode]
  if (!stateName) {
    return { valid: false, error: `Unknown GST state code "${stateCode}"` }
  }
  const expected = gstinCheckDigit(gstin.slice(0, 14))
  if (gstin[14] !== expected) {
    return {
      valid: false,
      error: "GSTIN check digit doesn't match — the number has a typo",
    }
  }
  return {
    valid: true,
    gstin,
    stateCode,
    stateName,
    pan: gstin.slice(2, 12),
    entityCode: gstin[12],
  }
}

export function isValidGSTIN(input: string | null | undefined): boolean {
  return validateGSTIN(input).valid
}

// ─── PAN ─────────────────────────────────────────────────────────────────────

const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

/** 4th character of a PAN encodes the holder's constitution. */
export const PAN_ENTITY_TYPES: Record<string, string> = {
  P: "Individual",
  C: "Company",
  H: "HUF",
  F: "Firm / LLP",
  A: "AOP",
  T: "Trust",
  B: "BOI",
  L: "Local Authority",
  J: "Artificial Juridical Person",
  G: "Government",
}

export function normalizePAN(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, "").toUpperCase()
}

export type PanValidation =
  | { valid: true; pan: string; entityTypeCode: string; entityType: string }
  | { valid: false; error: string }

/**
 * PAN structural validation. (The 10th char is a check character but the
 * Income-tax Dept has never published its algorithm, so structure + entity
 * letter is the strongest offline validation possible.)
 */
export function validatePAN(input: string | null | undefined): PanValidation {
  const pan = normalizePAN(input)
  if (pan.length !== 10) {
    return { valid: false, error: "PAN must be exactly 10 characters" }
  }
  if (!PAN_SHAPE.test(pan)) {
    return { valid: false, error: "PAN format is invalid (expected e.g. ABCDE1234F)" }
  }
  const entityTypeCode = pan[3]
  const entityType = PAN_ENTITY_TYPES[entityTypeCode]
  if (!entityType) {
    return {
      valid: false,
      error: `PAN 4th character "${entityTypeCode}" is not a valid holder type`,
    }
  }
  return { valid: true, pan, entityTypeCode, entityType }
}

export function isValidPAN(input: string | null | undefined): boolean {
  return validatePAN(input).valid
}

/**
 * Cross-field check: a GSTIN embeds the holder's PAN in characters 3–12.
 * Returns an error message when both are present but disagree; null otherwise.
 */
export function gstinPanMismatch(
  gstin: string | null | undefined,
  pan: string | null | undefined
): string | null {
  const g = validateGSTIN(gstin)
  const p = validatePAN(pan)
  if (!g.valid || !p.valid) return null // individual validators report their own errors
  if (g.pan !== p.pan) {
    return `GSTIN belongs to PAN ${g.pan}, but PAN entered is ${p.pan}`
  }
  return null
}

// ─── TAN ─────────────────────────────────────────────────────────────────────

const TAN_SHAPE = /^[A-Z]{4}[0-9]{5}[A-Z]$/

export function normalizeTAN(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, "").toUpperCase()
}

/** TAN: 3-letter jurisdiction code + deductor initial + 5 digits + check letter. */
export function isValidTAN(input: string | null | undefined): boolean {
  return TAN_SHAPE.test(normalizeTAN(input))
}

// ─── IFSC ────────────────────────────────────────────────────────────────────

const IFSC_SHAPE = /^[A-Z]{4}0[A-Z0-9]{6}$/

export function normalizeIFSC(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, "").toUpperCase()
}

/** IFSC: 4-letter bank code + reserved "0" + 6-char branch code. */
export function isValidIFSC(input: string | null | undefined): boolean {
  return IFSC_SHAPE.test(normalizeIFSC(input))
}
