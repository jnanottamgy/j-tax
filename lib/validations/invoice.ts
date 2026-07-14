import { z } from "zod"

import { GSTIN_STATE_CODES } from "@/lib/invoices/gst"

const invoiceStatusEnum = z.enum([
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "DISPUTED",
  "WAIVED",
])

const serviceTypeEnum = z.enum([
  "GST_RETURN",
  "INCOME_TAX",
  "TDS",
  "PAYROLL",
  "BOOKKEEPING",
  "AUDIT",
  "COMPANY_LAW",
  "OTHER",
])

/** GST slabs applicable to professional services */
export const GST_RATES = ["0", "5", "12", "18", "28"] as const

// Service-based billing for a tax/accounting practice: the firm bills a
// professional fee for an engagement plus GST — there is no quantity.
export const invoiceSchema = z
  .object({
    clientId: z.string().min(1, "Client is required"),
    // Auto-generated server-side; never user-supplied. Optional here so the
    // create path (which sends no number) and the edit path (which resubmits
    // the read-only existing number) both validate.
    invoiceNumber: z.string().trim().optional(),
    serviceDescription: z
      .string()
      .trim()
      .min(1, "Describe the professional service being billed")
      .max(500),
    serviceType: serviceTypeEnum.optional(),
    professionalFee: z
      .string()
      .trim()
      .min(1, "Professional fee is required")
      .refine((v) => {
        const n = parseFloat(v)
        return !Number.isNaN(n) && n > 0 && n <= 100000000
      }, "Professional fee must be between ₹1 and ₹10,00,00,000"),
    taxRate: z.enum(GST_RATES).default("18"),
    // GST place of supply — 2-digit state code; drives CGST/SGST vs IGST.
    // Optional: the server falls back to the client's GSTIN state, then the firm's.
    placeOfSupply: z
      .string()
      .trim()
      .refine((v) => Boolean(GSTIN_STATE_CODES[v]), "Select a valid place of supply")
      .optional(),
    // SAC 9982 = accounting, auditing, bookkeeping & tax consultancy services.
    hsnSac: z
      .string()
      .trim()
      .max(8, "HSN/SAC can be at most 8 characters")
      .optional()
      .transform((v) => (v ? v : "9982")),
    issueDate: z.string().min(1, "Issue date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    status: invoiceStatusEnum.default("DRAFT"),
    remarks: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.issueDate || !data.dueDate) return true
      return new Date(data.dueDate) >= new Date(data.issueDate)
    },
    {
      message: "Due date must be on or after the issue date",
      path: ["dueDate"],
    }
  )

export type InvoiceFormValues = z.infer<typeof invoiceSchema>

export function parseInvoiceFormData(formData: FormData) {
  return invoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    invoiceNumber: formData.get("invoiceNumber") || undefined,
    serviceDescription: formData.get("serviceDescription"),
    serviceType: (formData.get("serviceType") as string) || undefined,
    professionalFee: formData.get("professionalFee"),
    taxRate: (formData.get("taxRate") as string) || "18",
    placeOfSupply: (formData.get("placeOfSupply") as string) || undefined,
    hsnSac: (formData.get("hsnSac") as string) || undefined,
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    status: (formData.get("status") as string) || "DRAFT",
    remarks: (formData.get("remarks") as string) || undefined,
  })
}

/** How clients actually pay a CA firm in India */
export const PAYMENT_METHODS = [
  "Bank Transfer (NEFT/IMPS/RTGS)",
  "UPI",
  "Cheque",
  "Cash",
  "Card",
  "Other",
] as const

export const recordPaymentSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Payment amount is required")
    .refine((v) => {
      const n = parseFloat(v)
      return !Number.isNaN(n) && n > 0
    }, "Payment amount must be a positive number"),
  method: z.string().trim().optional().or(z.literal("")),
  reference: z.string().trim().optional().or(z.literal("")),
})

export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>

export const followUpSchema = z.object({
  notes: z.string().trim().min(1, "Follow-up notes are required"),
})

export type FollowUpFormValues = z.infer<typeof followUpSchema>
