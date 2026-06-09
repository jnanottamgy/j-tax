import { z } from "zod"

export const messageSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  phoneNumber: z.string().trim().min(10, "Phone number must be at least 10 digits"),
  content: z.string().trim().min(1, "Message content is required"),
  templateId: z.string().optional().or(z.literal("")),
})

export const templateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required"),
  type: z.enum([
    "DOCUMENT_REMINDER",
    "COMPLIANCE_REMINDER",
    "PAYMENT_REMINDER",
    "TASK_ASSIGNMENT",
    "OVERDUE_NOTIFICATION",
    "CUSTOM",
  ]),
  content: z.string().trim().min(1, "Template content is required"),
  variables: z.array(z.string()).optional(),
})

export type TemplateFormValues = z.infer<typeof templateSchema>

export type SendMessageFormValues = z.infer<typeof messageSchema>
