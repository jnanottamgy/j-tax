export interface EmployeeListItem {
  id: string
  name: string
  email: string
  department: string | null
  /** Hourly rate the firm charges for this person, or null if not hourly. */
  billingRatePerHour?: number | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  /** Role of the linked login account (null when no login exists yet) */
  role?: "EMPLOYEE" | "MANAGER" | null
}
