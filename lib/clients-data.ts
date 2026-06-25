export type ClientStatus = "active" | "inactive" | "pending" | "on_hold"
export type ClientPriority = "low" | "medium" | "high" | "critical"

export type Client = {
  id: string
  name: string
  code: string
  gstin: string
  assignedEmployee: string
  status: ClientStatus
  priority: ClientPriority
  dueDate: string
}

export const clientStatusLabels: Record<ClientStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
  on_hold: "On Hold",
}

export const clientPriorityLabels: Record<ClientPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export const clientsData: Client[] = [
  {
    id: "1",
    name: "Acme Holdings LLC",
    code: "CLT-1001",
    gstin: "27AABCU9603R1ZM",
    assignedEmployee: "Sarah Johnson",
    status: "active",
    priority: "high",
    dueDate: "2026-03-15",
  },
  {
    id: "2",
    name: "Northwind Partners",
    code: "CLT-1002",
    gstin: "29AADCN1234P1Z5",
    assignedEmployee: "Michael Chen",
    status: "pending",
    priority: "critical",
    dueDate: "2026-02-28",
  },
  {
    id: "3",
    name: "Vertex Global Inc",
    code: "CLT-1003",
    gstin: "07AAACV5678K1Z2",
    assignedEmployee: "Sarah Johnson",
    status: "active",
    priority: "medium",
    dueDate: "2026-04-10",
  },
  {
    id: "4",
    name: "Summit Retail Group",
    code: "CLT-1004",
    gstin: "19AABCS9012M1Z8",
    assignedEmployee: "Emily Rodriguez",
    status: "on_hold",
    priority: "high",
    dueDate: "2026-03-01",
  },
  {
    id: "5",
    name: "Blue Harbor Logistics",
    code: "CLT-1005",
    gstin: "24AABCB3456N1Z1",
    assignedEmployee: "James Wilson",
    status: "active",
    priority: "low",
    dueDate: "2026-05-20",
  },
  {
    id: "6",
    name: "Orion Tech Solutions",
    code: "CLT-1006",
    gstin: "33AACCO7890Q1Z4",
    assignedEmployee: "Michael Chen",
    status: "inactive",
    priority: "low",
    dueDate: "2026-01-31",
  },
  {
    id: "7",
    name: "Pinnacle Manufacturing",
    code: "CLT-1007",
    gstin: "06AABCP2345R1Z7",
    assignedEmployee: "Emily Rodriguez",
    status: "active",
    priority: "medium",
    dueDate: "2026-03-28",
  },
  {
    id: "8",
    name: "Sterling Financial Services",
    code: "CLT-1008",
    gstin: "11AABCS6789T1Z3",
    assignedEmployee: "Sarah Johnson",
    status: "pending",
    priority: "high",
    dueDate: "2026-02-20",
  },
  {
    id: "9",
    name: "Cascade Healthcare",
    code: "CLT-1009",
    gstin: "32AABCC0123U1Z6",
    assignedEmployee: "James Wilson",
    status: "active",
    priority: "critical",
    dueDate: "2026-02-15",
  },
  {
    id: "10",
    name: "Horizon Media Group",
    code: "CLT-1010",
    gstin: "09AABCH4567V1Z9",
    assignedEmployee: "Michael Chen",
    status: "on_hold",
    priority: "medium",
    dueDate: "2026-04-05",
  },
  {
    id: "11",
    name: "Atlas Construction Co",
    code: "CLT-1011",
    gstin: "22AABCA8901W1Z2",
    assignedEmployee: "Emily Rodriguez",
    status: "active",
    priority: "high",
    dueDate: "2026-03-10",
  },
  {
    id: "12",
    name: "Nova Energy Systems",
    code: "CLT-1012",
    gstin: "36AABCN2345X1Z5",
    assignedEmployee: "James Wilson",
    status: "pending",
    priority: "medium",
    dueDate: "2026-03-22",
  },
  {
    id: "13",
    name: "Meridian Exports Ltd",
    code: "CLT-1013",
    gstin: "08AABCM5678Y1Z8",
    assignedEmployee: "Sarah Johnson",
    status: "inactive",
    priority: "low",
    dueDate: "2025-12-15",
  },
  {
    id: "14",
    name: "Quantum Software Pvt Ltd",
    code: "CLT-1014",
    gstin: "27AABCQ9012Z1Z1",
    assignedEmployee: "Michael Chen",
    status: "active",
    priority: "high",
    dueDate: "2026-04-18",
  },
  {
    id: "15",
    name: "Evergreen Agro Products",
    code: "CLT-1015",
    gstin: "18AABCE3456A1Z4",
    assignedEmployee: "Emily Rodriguez",
    status: "active",
    priority: "low",
    dueDate: "2026-05-05",
  },
  {
    id: "16",
    name: "Titan Automotive Parts",
    code: "CLT-1016",
    gstin: "13AABCT6789B1Z7",
    assignedEmployee: "James Wilson",
    status: "on_hold",
    priority: "critical",
    dueDate: "2026-02-25",
  },
  {
    id: "17",
    name: "Lighthouse Hospitality",
    code: "CLT-1017",
    gstin: "04AABCL0123C1Z0",
    assignedEmployee: "Sarah Johnson",
    status: "pending",
    priority: "medium",
    dueDate: "2026-03-05",
  },
  {
    id: "18",
    name: "Fusion Biotech Research",
    code: "CLT-1018",
    gstin: "37AABCF4567D1Z3",
    assignedEmployee: "Michael Chen",
    status: "active",
    priority: "high",
    dueDate: "2026-04-01",
  },
]

export const PAGE_SIZE = 8
