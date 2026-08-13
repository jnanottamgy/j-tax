import { z } from "zod"
import { validateGSTIN, validatePAN, gstinPanMismatch } from "@/lib/india/validators"

/**
 * India-aware statutory checks, attached object-level so error messages are
 * specific ("check digit doesn't match", "GSTIN belongs to PAN …") instead of
 * a generic "invalid format". Runs after field transforms (trim + uppercase).
 */
function indiaStatutoryChecks(
  data: { gstin?: string; pan?: string; clientType?: string; clientTypeCustom?: string },
  ctx: z.RefinementCtx
) {
  if (data.gstin) {
    const r = validateGSTIN(data.gstin)
    if (!r.valid) {
      ctx.addIssue({ code: "custom", path: ["gstin"], message: r.error })
      return // skip cross-check when GSTIN itself is broken
    }
  }
  if (data.pan) {
    const r = validatePAN(data.pan)
    if (!r.valid) {
      ctx.addIssue({ code: "custom", path: ["pan"], message: r.error })
      return
    }
  }
  const mismatch = gstinPanMismatch(data.gstin, data.pan)
  if (mismatch) {
    ctx.addIssue({ code: "custom", path: ["pan"], message: mismatch })
  }
  if (data.clientType === "OTHER" && !data.clientTypeCustom) {
    ctx.addIssue({
      code: "custom",
      path: ["clientTypeCustom"],
      message: "Enter the client type",
    })
  }
}

export const serviceAssignmentSchema = z.object({
  serviceType: z.enum([
    "GST_RETURN",
    "INCOME_TAX",
    "TDS",
    "PAYROLL",
    "BOOKKEEPING",
    "AUDIT",
    "COMPANY_LAW",
    "INCORPORATION",
    "OTHER",
  ]),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
  nextDueDate: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid due date"),
  /**
   * Fee agreed per billing occurrence, excluding GST.
   *
   * This is the engagement's commercial term. Carried across from the accepted
   * quotation when the client is converted, so the price the client agreed to
   * survives into the record the firm bills against — previously it was shown
   * once on the quotation and then lost.
   */
  agreedFee: z.coerce
    .number()
    .min(0, "Fee cannot be negative")
    .max(99_999_999, "Fee is out of range")
    .optional(),
  /** Null/undefined = bill on the same cycle the work is filed on. */
  billingFrequency: z
    .enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"])
    .optional(),
  /** Provenance: the quotation line this fee came from. */
  sourceQuotationItemId: z.string().optional(),
  /** Required name when serviceType is OTHER; ignored for standard types. */
  customName: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine((v) => !v || v.length <= 120, "Service name is too long"),
}).refine(
  (s) => s.serviceType !== "OTHER" || Boolean(s.customName),
  { message: "Enter the name of the other service", path: ["customName"] }
)

/** Pure field schema — statutory checks are attached on the exported schemas. */
const clientBaseSchema = z.object({
  name: z
    .string()
    .min(2, "Client name must be at least 2 characters")
    .max(200, "Client name is too long"),
  companyName: z
    .string()
    .max(200, "Company name is too long")
    .optional()
    .transform((v) => v?.trim() || undefined),
  clientType: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined),
  clientTypeCustom: z
    .string()
    .max(120, "Client type is too long")
    .optional()
    .transform((v) => v?.trim() || undefined),
  // Form sends the string "true"/"false"; z.coerce.boolean() would wrongly turn
  // "false" into true, so parse explicitly. Missing → defaults to incorporated.
  isIncorporated: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (typeof v === "boolean" ? v : v !== "false")),
  gstin: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || undefined),
  pan: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || undefined),
  // ── Accounting year & scale ────────────────────────────────────────────────
  /**
   * Month the client's books close, 1–12. The app assumed 31 March everywhere;
   * a foreign-parented subsidiary usually closes in December to match its group.
   * Indian statutory deadlines still run April–March by law, so this drives the
   * firm's own planning rather than the statutory calendar.
   */
  fyEndMonth: z.coerce.number().int().min(1).max(12).optional().default(3),
  /** Aggregate annual turnover in rupees. Drives GST cadence and s.44AB. */
  annualTurnover: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return undefined
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 ? n : undefined
    }),
  /** Which FY the turnover figure is from, e.g. "2024-25". */
  turnoverFy: z
    .string()
    .max(9)
    .optional()
    .transform((v) => v?.trim() || undefined),
  /** Blank = derive from turnover; see lib/compliance/gst-scheme.ts. */
  gstFilingScheme: z
    .enum(["MONTHLY", "QRMP"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  email: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email"),
  phone: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine(
      (v) => !v || /^[+]?[\d\s\-().]{7,20}$/.test(v),
      "Invalid phone number format"
    ),
  whatsapp: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine(
      (v) => !v || /^[+]?[\d\s\-().]{7,20}$/.test(v),
      "Invalid WhatsApp number format"
    ),
  address: z.string().optional().transform((v) => v?.trim() || undefined),
  notes: z.string().optional().transform((v) => v?.trim() || undefined),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  assignedEmployeeId: z.string().optional().transform((v) => v || undefined),
  reminderDaysBefore: z.coerce.number().int().min(1).max(60).default(7),
  notificationPreferences: z
    .array(z.enum(["EMAIL", "WHATSAPP", "DASHBOARD"]))
    .default(["EMAIL", "DASHBOARD"]),
  services: z
    .array(serviceAssignmentSchema)
    .min(1, "Select at least one service"),
  /** Document-checklist labels already collected at onboarding. */
  collectedDocuments: z.array(z.string()).optional().default([]),
})

export const createClientSchema = clientBaseSchema.superRefine(indiaStatutoryChecks)

export type CreateClientInput = z.infer<typeof createClientSchema>

export const updateClientSchema = clientBaseSchema
  .omit({ services: true, collectedDocuments: true })
  .extend({
    status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "ON_HOLD"]),
    assignedEmployeeId: z
      .string()
      .optional()
      .transform((v) => v || null),
    // Editable in the Edit-client dialog; omitted when the caller isn't
    // touching services (undefined = leave services unchanged).
    services: z.array(serviceAssignmentSchema).optional(),
  })
  .superRefine(indiaStatutoryChecks)

export type UpdateClientInput = z.infer<typeof updateClientSchema>

export const createClientFormSchema = clientBaseSchema.extend({
  gstin: z.string().optional(),
  pan: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateClientFormInput = z.infer<typeof createClientFormSchema>
