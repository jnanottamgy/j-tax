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

/**
 * Prisma `where` fragment limiting Client rows to what this session may see.
 * PARTNER/MANAGER → no restriction. EMPLOYEE → only their assigned clients.
 * EMPLOYEE with no linked Employee record → matches nothing (safe default).
 *
 * Spread into any client query:
 *   where: { ...(await getClientScopeWhere(session)), deletedAt: null }
 * or nest it: where: { client: await getClientScopeWhere(session) }
 */
export async function getClientScopeWhere(
  session: SessionInfo
): Promise<{ assignedEmployeeId?: string; id?: string }> {
  if (!isEmployee(session.user.role)) return {}
  const employeeId = await getLinkedEmployeeId(session.user.id)
  if (!employeeId) return { id: "__no_visible_clients__" }
  return { assignedEmployeeId: employeeId }
}

/**
 * May this session act on this specific client's data?
 *
 * Two independent checks, in order:
 *  1. TENANT — the client must exist inside the caller's firm. `prisma.client`
 *     is firm-scoped by the tenant extension, so a clientId belonging to
 *     another firm resolves to null here and the answer is `false`. This runs
 *     for EVERY role, including PARTNER/MANAGER: firm boundaries are not a
 *     seniority question, and callers pass ids straight from the request.
 *  2. ROW — EMPLOYEE additionally only reaches clients assigned to them.
 *
 * Use on every per-client read/mutation that takes a caller-supplied clientId.
 */
export async function canAccessClientById(
  session: SessionInfo,
  clientId: string
): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { assignedEmployeeId: true },
  })
  if (!client) return false

  if (!isEmployee(session.user.role)) return true

  const employeeId = await getLinkedEmployeeId(session.user.id)
  if (!employeeId) return false
  return client.assignedEmployeeId === employeeId
}

/**
 * Firm-boundary filter for CHILD tables that carry no `firmId` of their own
 * (ClientCredential, ClientContact, ClientTeamMember, TaskComment, …).
 *
 * The tenant extension in lib/prisma.ts injects `firmId` only into the ~33
 * top-level models that have the column. A child row fetched directly by its
 * own id therefore bypasses tenancy entirely — so every such query must carry
 * an explicit relational firm filter. Spread these into the `where`:
 *
 *   prisma.clientCredential.findFirst({
 *     where: { id, ...clientFirmFilter(session) },
 *   })
 *
 * Note `findFirst`, not `findUnique` — `findUnique` accepts only unique fields
 * and will reject the relational condition.
 */
export function clientFirmFilter(session: SessionInfo): {
  client: { firmId: string }
} {
  return { client: { firmId: requireFirmId(session) } }
}

/** Same, for children hanging off a Task (TaskComment, TaskAttachment, …). */
export function taskFirmFilter(session: SessionInfo): {
  task: { firmId: string }
} {
  return { task: { firmId: requireFirmId(session) } }
}

/**
 * The caller's resolved tenant. `requireAuth` always sets this before any
 * action body runs; a missing value means the guard was bypassed, which must
 * fail closed rather than silently widen the query to every firm.
 */
function requireFirmId(session: SessionInfo): string {
  const firmId = session.user.firmId
  if (!firmId) throw new Error("Unauthorized: no tenant context")
  return firmId
}

// ─── Legacy aliases ────────────────────────────────────────────────────────────
// Keep backward-compat exports until all callers are migrated.
/** @deprecated use getEmployeeScopeId */
export const getExecutiveEmployeeId = getEmployeeScopeId
/** @deprecated use isEmployee */
export const isExecutive = isEmployee
