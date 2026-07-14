import type {
  ClientPriority,
  ClientStatus,
  ServiceFrequency,
  ServiceType,
} from "@prisma/client"

export type ClientListItem = {
  id: string
  name: string
  companyName: string | null
  /** Entity-type code (see CLIENT_TYPE_OPTIONS), stored in Client.entityType. */
  clientType: string | null
  clientTypeCustom: string | null
  isIncorporated: boolean
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
  services: {
    type: ServiceType
    frequency: ServiceFrequency
    /** Custom name when type is OTHER. */
    customName?: string | null
  }[]
  nextDueDate: string | null
  createdAt: string
}

export type EmployeeOption = {
  id: string
  name: string
  department: string | null
}
