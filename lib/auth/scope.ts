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

/** For EXECUTIVE users, returns their Employee.id for row-level filters. */
export async function getExecutiveEmployeeId(
  session: SessionInfo
): Promise<string | null> {
  if (session.user.role !== "EXECUTIVE") return null
  return getLinkedEmployeeId(session.user.id)
}

export function isExecutive(role: AppRole): boolean {
  return role === "EXECUTIVE"
}

export function canAccessAssignedClient(
  session: SessionInfo,
  executiveEmployeeId: string | null,
  assignedEmployeeId: string | null | undefined
): boolean {
  if (!isExecutive(session.user.role)) return true
  if (!executiveEmployeeId) return false
  return assignedEmployeeId === executiveEmployeeId
}

export function canAccessAssignedTask(
  session: SessionInfo,
  executiveEmployeeId: string | null,
  assignedEmployeeId: string | null | undefined
): boolean {
  return canAccessAssignedClient(session, executiveEmployeeId, assignedEmployeeId)
}

export function clientWhereForSession(
  executiveEmployeeId: string | null
): { assignedEmployeeId: string } | undefined {
  if (!executiveEmployeeId) return undefined
  return { assignedEmployeeId: executiveEmployeeId }
}
