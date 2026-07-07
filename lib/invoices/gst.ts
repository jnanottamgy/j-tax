/**
 * GST helpers for tax invoices — state codes, GSTIN parsing, and the
 * CGST/SGST vs IGST split.
 *
 * Pure module (no server-only imports) so it is safe to use from both server
 * actions and client components (dialog previews).
 *
 * Split rules (Section 8/9, IGST Act):
 *   - Place of supply in the SAME state as the firm  → CGST + SGST, each half
 *     of the total GST: cgst = round(taxAmount / 2), sgst = taxAmount - cgst
 *     (so the two always sum exactly to taxAmount).
 *   - Different state → IGST = full taxAmount.
 *   - taxRate 0 / no tax → no split.
 */

import { GST_STATE_CODES } from "@/lib/india/validators"

/**
 * Official GSTIN state codes (first two digits of a GSTIN).
 * Single source of truth lives in lib/india/validators — re-exported here so
 * existing invoice imports keep working.
 */
export const GSTIN_STATE_CODES: Record<string, string> = GST_STATE_CODES

/** State options for <select>s, sorted by state name. */
export const GST_STATE_OPTIONS: Array<{ code: string; name: string }> =
  Object.entries(GSTIN_STATE_CODES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

/**
 * Extract the 2-digit state code from a GSTIN.
 * Returns null for missing/blank input or an unrecognised code.
 */
export function stateFromGstin(gstin?: string | null): string | null {
  if (!gstin) return null
  const code = gstin.trim().slice(0, 2)
  return GSTIN_STATE_CODES[code] ? code : null
}

/** Validate/normalise a bare 2-digit state code (returns null if unknown). */
export function normalizeStateCode(code?: string | null): string | null {
  if (!code) return null
  const trimmed = code.trim()
  return GSTIN_STATE_CODES[trimmed] ? trimmed : null
}

/** Human-readable state name for a 2-digit code (null if unknown). */
export function stateName(code?: string | null): string | null {
  if (!code) return null
  return GSTIN_STATE_CODES[code.trim()] ?? null
}

/**
 * Split a GST amount into CGST/SGST (intra-state) or IGST (inter-state).
 *
 * Rounding keeps the sum exact:
 *   cgst = Math.round((taxAmount / 2) * 100) / 100
 *   sgst = taxAmount - cgst   (re-rounded only to strip float noise)
 *
 * When either state is unknown we assume intra-state — place of supply
 * defaults to the firm's own state, so an unknown state means "local".
 */
export function computeGstSplit({
  taxAmount,
  firmState,
  placeOfSupply,
}: {
  taxAmount: number
  firmState: string | null
  placeOfSupply: string | null
}): { cgst: number; sgst: number; igst: number } {
  if (!taxAmount || taxAmount <= 0 || !Number.isFinite(taxAmount)) {
    return { cgst: 0, sgst: 0, igst: 0 }
  }

  // Inter-state supply → IGST on the full tax amount.
  if (firmState && placeOfSupply && firmState !== placeOfSupply) {
    return { cgst: 0, sgst: 0, igst: Math.round(taxAmount * 100) / 100 }
  }

  // Intra-state supply → equal CGST/SGST halves that sum exactly to taxAmount.
  const cgst = Math.round((taxAmount / 2) * 100) / 100
  const sgst = Math.round((taxAmount - cgst) * 100) / 100
  return { cgst, sgst, igst: 0 }
}
