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
  items: Array<{ serviceType?: string | null; description?: string | null }>
): MappedService[] {
  const byType = new Map<ServiceType, MappedService>()
  const otherNames: string[] = []

  for (const item of items) {
    const key = (item.serviceType ?? "").trim()
    const mapped = MAP[key]
    if (mapped) {
      if (!byType.has(mapped.serviceType)) {
        byType.set(mapped.serviceType, { ...mapped })
      }
    } else {
      // Custom / advisory / unknown → OTHER
      const name = (key && key !== "Custom Service" ? key : item.description?.trim()) || "Custom service"
      otherNames.push(name)
    }
  }

  const result = [...byType.values()]
  if (otherNames.length > 0) {
    result.push({
      serviceType: "OTHER",
      frequency: "ONE_TIME",
      customName: Array.from(new Set(otherNames)).join(", ").slice(0, 120),
    })
  }
  // Always at least one service (create-client validation requires min 1).
  if (result.length === 0) {
    result.push({ serviceType: "OTHER", frequency: "ONE_TIME", customName: "Professional services" })
  }
  return result
}
