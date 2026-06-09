export interface EmployeeListItem {
  id: string
  name: string
  email: string
  department: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
