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
  /**
   * "UNREGISTERED" once someone has confirmed the client has no GST
   * registration. Only meaningful when `gstin` is null — it is what separates
   * "correctly B2C" from "nobody has asked", which a blank GSTIN alone cannot.
   */
  gstRegistration: string | null
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
  // ── Accounting year & scale ────────────────────────────────────────────
  /** Month the client's books close, 1–12. 3 = 31 March (the Indian default). */
  fyEndMonth?: number | null
  /** Aggregate annual turnover in rupees — drives GST cadence and s.44AB. */
  annualTurnover?: number | null
  turnoverFy?: string | null
  /** MONTHLY | QRMP. Null = derive from turnover. */
  gstFilingScheme?: string | null
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
