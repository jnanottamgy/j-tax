import type { ServiceFrequency, ServiceType } from "@prisma/client"

/**
 * Maps a quotation line item (free-text serviceType from the quotation builder,
 * plus its description) onto a client ClientService assignment.
 *
 * Quotations don't capture a filing frequency, so we infer a sensible default.
 * Unknown/custom lines fall back to OTHER with a customName (required by the
 * create-client validation for OTHER).
 */
export type MappedService = {
  serviceType: ServiceType
  frequency: ServiceFrequency
  customName?: string
  /**
   * The price the client accepted, excluding GST, carried straight through to
   * the engagement. Without this the agreed fee died at acceptance and every
   * invoice afterwards was a number retyped from memory.
   */
  agreedFee?: number
  /** The quotation line it came from, so the fee can be traced to its source. */
  sourceQuotationItemId?: string
}

const MAP: Record<string, { serviceType: ServiceType; frequency: ServiceFrequency }> = {
  "GST Filing (Monthly)": { serviceType: "GST_RETURN", frequency: "MONTHLY" },
  "GST Filing (Quarterly)": { serviceType: "GST_RETURN", frequency: "QUARTERLY" },
  "Income Tax Return": { serviceType: "INCOME_TAX", frequency: "ANNUAL" },
  "TDS Filing": { serviceType: "TDS", frequency: "QUARTERLY" },
  Incorporation: { serviceType: "INCORPORATION", frequency: "ONE_TIME" },
  "Company Registration": { serviceType: "INCORPORATION", frequency: "ONE_TIME" },
  "ROC Compliance": { serviceType: "COMPANY_LAW", frequency: "ANNUAL" },
  "Payroll Processing": { serviceType: "PAYROLL", frequency: "MONTHLY" },
  Bookkeeping: { serviceType: "BOOKKEEPING", frequency: "MONTHLY" },
  "Statutory Audit": { serviceType: "AUDIT", frequency: "ANNUAL" },
  "Internal Audit": { serviceType: "AUDIT", frequency: "ANNUAL" },
}

/**
 * Convert quotation line items into a de-duplicated list of client services.
 * ClientService is unique per (client, serviceType), so duplicate enum hits are
 * collapsed; multiple unmapped lines collapse into a single OTHER whose
 * customName joins their names.
 */
export function mapQuotationItemsToServices(
  items: Array<{
    id?: string
    serviceType?: string | null
    description?: string | null
    /** Line subtotal before tax — Prisma Decimal, number or numeric string. */
    unitPrice?: unknown
    quantity?: number | null
  }>
): MappedService[] {
  const byType = new Map<ServiceType, MappedService>()
  const otherNames: string[] = []
  let otherFee = 0
  let otherItemId: string | undefined

  for (const item of items) {
    // Pre-tax line value. GST is recomputed at invoice time from the firm's own
    // slab, so the engagement stores the professional fee alone.
    const fee = lineFee(item.unitPrice, item.quantity)
    const key = (item.serviceType ?? "").trim()
    const mapped = MAP[key]

    if (mapped) {
      const existing = byType.get(mapped.serviceType)
      if (existing) {
        // Two quotation lines collapsing onto one service type: the engagement
        // fee is their sum, not whichever happened to come first.
        existing.agreedFee = (existing.agreedFee ?? 0) + fee
      } else {
        byType.set(mapped.serviceType, {
          ...mapped,
          agreedFee: fee,
          sourceQuotationItemId: item.id,
        })
      }
    } else {
      // Custom / advisory / unknown → OTHER
      const name = (key && key !== "Custom Service" ? key : item.description?.trim()) || "Custom service"
      otherNames.push(name)
      otherFee += fee
      otherItemId ??= item.id
    }
  }

  const result = [...byType.values()]
  if (otherNames.length > 0) {
    result.push({
      serviceType: "OTHER",
      frequency: "ONE_TIME",
      customName: Array.from(new Set(otherNames)).join(", ").slice(0, 120),
      agreedFee: otherFee,
      sourceQuotationItemId: otherItemId,
    })
  }
  // Always at least one service (create-client validation requires min 1).
  if (result.length === 0) {
    result.push({ serviceType: "OTHER", frequency: "ONE_TIME", customName: "Professional services" })
  }
  return result
}

/** Line total before tax, tolerant of Prisma Decimal / string / number. */
function lineFee(unitPrice: unknown, quantity?: number | null): number {
  const price = Number(unitPrice ?? 0)
  const qty = Number(quantity ?? 1)
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return 0
  return Math.max(0, Math.round(price * qty * 100) / 100)
}
