import type {
  ClientPriority,
  ClientStatus,
  ServiceFrequency,
  ServiceType,
} from "@prisma/client"

export type ClientListItem = {
  id: string
  name: string
  code: string
  gstin: string | null
  pan: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  notes: string | null
  assignedEmployeeId: string | null
  assignedEmployee: string
  status: ClientStatus
  priority: ClientPriority
  services: { type: ServiceType; frequency: ServiceFrequency }[]
  nextDueDate: string | null
  createdAt: string
}

export type EmployeeOption = {
  id: string
  name: string
  department: string | null
}
