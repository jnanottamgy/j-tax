import { prisma } from "@/lib/prisma"
import type { AppRole } from "@/lib/auth/types"
import type { SessionInfo } from "@/lib/auth/types"

/**
 * Resolves the Employee.id linked to an auth user.
 * Client/task assignment uses Employee.id, not Supabase User.id.
 */
export async function getLinkedEmployeeId(userId: string): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, isActive: true },
  })
  if (!employee?.isActive) return null
  return employee.id
}

/**
 * For EMPLOYEE users, returns their Employee.id for row-level data filters.
 * Returns null for PARTNER and MANAGER (they see all data).
 */
export async function getEmployeeScopeId(
  session: SessionInfo
): Promise<string | null> {
  if (session.user.role !== "EMPLOYEE") return null
  return getLinkedEmployeeId(session.user.id)
}

export function isEmployee(role: AppRole): boolean {
  return role === "EMPLOYEE"
}

export function canAccessAssignedClient(
  session: SessionInfo,
  employeeScopeId: string | null,
  assignedEmployeeId: string | null | undefined
): boolean {
  if (!isEmployee(session.user.role)) return true
  if (!employeeScopeId) return false
  return assignedEmployeeId === employeeScopeId
}

export function canAccessAssignedTask(
  session: SessionInfo,
  employeeScopeId: string | null,
  assignedEmployeeId: string | null | undefined
): boolean {
  return canAccessAssignedClient(session, employeeScopeId, assignedEmployeeId)
}

export function clientWhereForSession(
  employeeScopeId: string | null
): { assignedEmployeeId: string } | undefined {
  if (!employeeScopeId) return undefined
  return { assignedEmployeeId: employeeScopeId }
}

// ─── Legacy aliases ────────────────────────────────────────────────────────────
// Keep backward-compat exports until all callers are migrated.
/** @deprecated use getEmployeeScopeId */
export const getExecutiveEmployeeId = getEmployeeScopeId
/** @deprecated use isEmployee */
export const isExecutive = isEmployee
