// Approval workflow system for operations that require sign-off

export interface ApprovalRequest {
  id: string
  entityType: string
  entityId: string
  action: string
  requestedBy: string
  requestedByName: string
  data: any
  status: "PENDING" | "APPROVED" | "REJECTED"
  approvedBy?: string
  approvedByName?: string
  approvedAt?: Date
  rejectedBy?: string
  rejectedByName?: string
  rejectedAt?: Date
  rejectionReason?: string
  createdAt: Date
}

export interface ApprovalConfig {
  requiresApproval: boolean
  approverRoles: string[]
  autoApproveForRoles: string[]
}

// Approval configurations for different entity types
const approvalConfigs: Record<string, ApprovalConfig> = {
  CLIENT_DELETE: {
    requiresApproval: true,
    approverRoles: ["PARTNER", "MANAGER"],
    autoApproveForRoles: ["PARTNER"],
  },
  TASK_DELETE: {
    requiresApproval: true,
    approverRoles: ["PARTNER", "MANAGER"],
    autoApproveForRoles: ["PARTNER"],
  },
  INVOICE_DELETE: {
    requiresApproval: true,
    approverRoles: ["PARTNER"],
    autoApproveForRoles: ["PARTNER"],
  },
  DOCUMENT_DELETE: {
    requiresApproval: true,
    approverRoles: ["PARTNER", "MANAGER"],
    autoApproveForRoles: ["PARTNER"],
  },
  EMPLOYEE_DELETE: {
    requiresApproval: true,
    approverRoles: ["PARTNER"],
    autoApproveForRoles: ["PARTNER"],
  },
}

export function getApprovalConfig(action: string): ApprovalConfig {
  return approvalConfigs[action] || {
    requiresApproval: false,
    approverRoles: [],
    autoApproveForRoles: [],
  }
}

export function requiresApproval(action: string, userRole: string): boolean {
  const config = getApprovalConfig(action)
  if (!config.requiresApproval) return false
  if (config.autoApproveForRoles.includes(userRole)) return false
  return true
}

export function canApprove(action: string, userRole: string): boolean {
  const config = getApprovalConfig(action)
  return config.approverRoles.includes(userRole)
}

export async function createApprovalRequest(
  entityType: string,
  entityId: string,
  action: string,
  requestedBy: string,
  requestedByName: string,
  data: any
): Promise<ApprovalRequest> {
  return {
    id: `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entityType,
    entityId,
    action,
    requestedBy,
    requestedByName,
    data,
    status: "PENDING",
    createdAt: new Date(),
  }
}

export async function approveRequest(
  request: ApprovalRequest,
  approvedBy: string,
  approvedByName: string
): Promise<ApprovalRequest> {
  return {
    ...request,
    status: "APPROVED",
    approvedBy,
    approvedByName,
    approvedAt: new Date(),
  }
}

export async function rejectRequest(
  request: ApprovalRequest,
  rejectedBy: string,
  rejectedByName: string,
  reason: string
): Promise<ApprovalRequest> {
  return {
    ...request,
    status: "REJECTED",
    rejectedBy,
    rejectedByName,
    rejectedAt: new Date(),
    rejectionReason: reason,
  }
}
