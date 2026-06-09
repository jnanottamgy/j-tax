import { z } from "zod"

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

export const serviceAssignmentSchema = z.object({
  serviceType: z.enum([
    "GST_RETURN",
    "INCOME_TAX",
    "TDS",
    "PAYROLL",
    "BOOKKEEPING",
    "AUDIT",
    "COMPANY_LAW",
    "OTHER",
  ]),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
  nextDueDate: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid due date"),
})

export const createClientSchema = z.object({
  name: z
    .string()
    .min(2, "Client name must be at least 2 characters")
    .max(200, "Client name is too long"),
  gstin: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || undefined)
    .refine((v) => !v || gstinRegex.test(v), "Invalid GSTIN format"),
  pan: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase() || undefined)
    .refine((v) => !v || panRegex.test(v), "Invalid PAN format"),
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
})

export type CreateClientInput = z.infer<typeof createClientSchema>

export const updateClientSchema = createClientSchema
  .omit({ services: true })
  .extend({
    status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "ON_HOLD"]),
    assignedEmployeeId: z
      .string()
      .optional()
      .transform((v) => v || null),
  })

export type UpdateClientInput = z.infer<typeof updateClientSchema>

export const createClientFormSchema = createClientSchema.extend({
  gstin: z.string().optional(),
  pan: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export type CreateClientFormInput = z.infer<typeof createClientFormSchema>
