import { z } from "zod"

export const STAFF_ROLES = ["EMPLOYEE", "MANAGER"] as const

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  department: z.string().trim().optional().or(z.literal("")),
  /**
   * What the firm charges per hour for this person. Blank = not billed by
   * the hour, which is the honest default for a fixed-fee practice.
   */
  billingRatePerHour: z
    .string()
    .optional()
    .refine(
      (v) => !v?.trim() || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      "Enter an hourly rate in rupees, or leave blank."
    ),
  role: z.enum(STAFF_ROLES).default("EMPLOYEE"),
  isActive: z.boolean().default(true),
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>

export function parseEmployeeFormData(formData: FormData) {
  return employeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    department: (formData.get("department") as string) || undefined,
    billingRatePerHour: (formData.get("billingRatePerHour") as string) || undefined,
    role: (formData.get("role") as string) || "EMPLOYEE",
    isActive: formData.get("isActive") === "true",
  })
}
