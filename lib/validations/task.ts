import { z } from "zod"

const taskStatusEnum = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "DATA_AWAITED",
  "UNDER_REVIEW",
  "FILED_DONE",
  "ON_HOLD",
])

const taskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"])

export const taskBaseSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().or(z.literal("")),
  status: taskStatusEnum.default("NOT_STARTED"),
  priority: taskPriorityEnum.default("MEDIUM"),
  dueDate: z.string().optional().or(z.literal("")),
  completionDate: z.string().optional(),
  serviceType: z
    .enum([
      "GST_RETURN",
      "INCOME_TAX",
      "TDS",
      "PAYROLL",
      "BOOKKEEPING",
      "AUDIT",
      "COMPANY_LAW",
      "OTHER",
    ])
    .optional(),
  assignedEmployeeId: z.string().optional().or(z.literal("")),
  remarks: z.string().optional(),
})

export const createTaskSchema = taskBaseSchema.extend({
  clientId: z.string().min(1, "Client is required"),
})

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>

export function parseCreateTaskFormData(formData: FormData) {
  return createTaskSchema.safeParse({
    title: formData.get("title"),
    description: (formData.get("description") as string) || undefined,
    status: formData.get("status") || "NOT_STARTED",
    priority: formData.get("priority") || "MEDIUM",
    dueDate: (formData.get("dueDate") as string) || undefined,
    completionDate: (formData.get("completionDate") as string) || undefined,
    serviceType: (formData.get("serviceType") as string) || undefined,
    assignedEmployeeId: (formData.get("assignedEmployeeId") as string) || undefined,
    remarks: (formData.get("remarks") as string) || undefined,
    clientId: formData.get("clientId"),
  })
}
