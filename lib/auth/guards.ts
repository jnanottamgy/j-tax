import { getSession } from "@/lib/auth/session"
import { canAccessRoute, hasMinimumRole, ROLE_LEVEL } from "@/lib/auth/roles"
import { logAccessDenied } from "@/lib/security"

/**
 * Enhanced Authentication & Authorization Guards
 * 
 * All guards now include:
 * - Rate limiting awareness
 * - Audit logging
 * - IP-based tracking
 * - Session validation
 */

export interface GuardContext {
  ip?: string
  userAgent?: string
  route?: string
}

/**
 * Require authentication - basic guard
 */
export async function requireAuth(context?: GuardContext) {
  const session = await getSession()
  if (!session) {
    if (context?.ip) {
      await logAccessDenied("unknown", context.route || "unknown", "authenticated", context.ip)
    }
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Require Partner role
 */
export async function requirePartner(context?: GuardContext) {
  const session = await requireAuth(context)
  if (session.user.role !== "PARTNER") {
    if (context?.ip) {
      await logAccessDenied(session.user.id, context.route || "unknown", "PARTNER", context.ip)
    }
    throw new Error("Forbidden: Partner access required")
  }
  return session
}

/**
 * Require Partner or Manager role
 */
export async function requirePartnerOrManager(context?: GuardContext) {
  const session = await requireAuth(context)
  if (session.user.role !== "PARTNER" && session.user.role !== "MANAGER") {
    if (context?.ip) {
      await logAccessDenied(
        session.user.id,
        context.route || "unknown",
        "PARTNER or MANAGER",
        context.ip
      )
    }
    throw new Error("Forbidden: Partner or Manager access required")
  }
  return session
}

/**
 * Require minimum role level
 */
export async function requireMinimumRole(
  minimumRole: keyof typeof ROLE_LEVEL,
  context?: GuardContext
) {
  const session = await requireAuth(context)
  if (!hasMinimumRole(session.user.role, minimumRole)) {
    if (context?.ip) {
      await logAccessDenied(
        session.user.id,
        context.route || "unknown",
        minimumRole,
        context.ip
      )
    }
    throw new Error(`Forbidden: ${minimumRole} or higher role required`)
  }
  return session
}

/**
 * Check route access based on role
 */
export async function requireRouteAccess(pathname: string, context?: GuardContext) {
  const session = await requireAuth(context)
  if (!canAccessRoute(session.user.role, pathname)) {
    if (context?.ip) {
      await logAccessDenied(session.user.id, pathname, "route access", context.ip)
    }
    throw new Error(`Forbidden: No access to ${pathname}`)
  }
  return session
}

/**
 * Check ownership of a resource
 * Use this for client-specific operations
 */
export async function requireResourceOwnership(
  resourceClientId: string,
  userClientId: string,
  context?: GuardContext
) {
  if (resourceClientId !== userClientId) {
    if (context?.ip) {
      await logAccessDenied(
        context?.route || "unknown",
        context?.route || "unknown",
        "resource owner",
        context.ip
      )
    }
    throw new Error("Forbidden: You can only access your own resources")
  }
}

/**
 * Check if user is staff (not CLIENT role)
 */
export async function requireStaff(context?: GuardContext) {
  const session = await requireAuth(context)
  if (session.user.role === "CLIENT") {
    if (context?.ip) {
      await logAccessDenied(session.user.id, context.route || "unknown", "staff", context.ip)
    }
    throw new Error("Forbidden: Staff access required")
  }
  return session
}

/**
 * Check if user is client
 */
export async function requireClient(context?: GuardContext) {
  const session = await requireAuth(context)
  if (session.user.role !== "CLIENT") {
    if (context?.ip) {
      await logAccessDenied(session.user.id, context.route || "unknown", "client", context.ip)
    }
    throw new Error("Forbidden: Client access required")
  }
  return session
}