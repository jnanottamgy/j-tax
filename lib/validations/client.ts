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
  isIncorporated: z.coerce.boolean().default(true),
  gstin: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || undefined),
  pan: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || undefined),
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
