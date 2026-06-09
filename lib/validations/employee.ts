import { z } from "zod"

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  department: z.string().trim().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>

export function parseEmployeeFormData(formData: FormData) {
  return employeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    department: (formData.get("department") as string) || undefined,
    isActive: formData.get("isActive") === "true",
  })
}
