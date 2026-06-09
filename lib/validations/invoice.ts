import { z } from "zod"

const invoiceStatusEnum = z.enum([
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "DISPUTED",
  "WAIVED",
])

export const invoiceSchema = z
  .object({
    clientId: z.string().min(1, "Client is required"),
    invoiceNumber: z.string().trim().min(1, "Invoice number is required"),
    amount: z
      .string()
      .trim()
      .min(1, "Amount is required")
      .refine((v) => {
        const n = parseFloat(v)
        return !Number.isNaN(n) && n > 0 && n <= 100000000
      }, "Amount must be between ₹1 and ₹10,00,00,000"),
    issueDate: z.string().min(1, "Issue date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    status: invoiceStatusEnum.default("DRAFT"),
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
    invoiceNumber: formData.get("invoiceNumber"),
    amount: formData.get("amount"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    status: (formData.get("status") as string) || "DRAFT",
  })
}

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
