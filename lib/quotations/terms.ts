/**
 * Shared quotation/engagement boilerplate for a tax & accounting practice.
 * Used by the on-screen document, the public portal, and the PDF so the
 * three renderings never drift apart.
 */

export const DEFAULT_QUOTATION_TERMS = [
  "1. This quotation is valid until the date stated above; fees may be revised thereafter.",
  "2. Professional fees are exclusive of government fees, statutory charges, late fees, and out-of-pocket expenses, which are billed at actuals.",
  "3. GST is charged at the prevailing rate as applicable to professional services.",
  "4. 50% of the professional fee is payable in advance; the balance is due on completion of the engagement.",
  "5. The engagement commences on receipt of acceptance and the advance payment, along with the required documents.",
  "6. Timelines depend on timely receipt of complete and accurate information from the client.",
].join("\n")

// Single source of truth for amount-in-words lives in lib/india/format —
// re-exported here so quotation callers keep their import path. (The lib
// version also handles ≥100 crore and 99.999→100.00 paise carry correctly.)
export { amountInWords } from "@/lib/india/format"
