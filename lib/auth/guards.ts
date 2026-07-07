import { getSession } from "@/lib/auth/session"
import { canAccessRoute, hasMinimumRole, ROLE_LEVEL } from "@/lib/auth/roles"
import { logAccessDenied } from "@/lib/security"
import { tenantContext } from "@/lib/tenant/context"

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
 * Require authentication - basic guard.
 *
 * Also resolves the signed-in user's FIRM and enters the tenant context:
 * from that point, every Prisma query in the request is automatically
 * scoped to that firm (lib/prisma.ts). All other guards funnel through here,
 * so tenancy is established exactly once per request.
 */
export async function requireAuth(context?: GuardContext) {
  const session = await getSession()
  if (!session) {
    if (context?.ip) {
      await logAccessDenied("unknown", context.route || "unknown", "authenticated", context.ip)
    }
    throw new Error("Unauthorized")
  }
  // Defense-in-depth: a provisioned user who hasn't set their own password
  // must not be able to skip the forced reset by calling server actions / APIs
  // directly. The set-password flow itself uses the raw Supabase client, not
  // this guard, so it is unaffected.
  if (session.mustChangePassword) {
    throw new Error("PasswordChangeRequired")
  }

  // ── Tenant resolution ──────────────────────────────────────────────────────
  // Dynamic import keeps this module importable from edge middleware.
  const { prisma } = await import("@/lib/prisma")

  // These lookups run BEFORE the tenant context exists, so they're unscoped
  // by design — they are what establish the scope.
  let userRow = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { firmId: true },
  })

  // Client-portal users can sign in before a mirror row exists: adopt them
  // into the firm that owns their (unambiguous) client record.
  if (!userRow && session.user.role === "CLIENT") {
    const matches = await prisma.client.findMany({
      where: { email: session.user.email, deletedAt: null },
      select: { firmId: true },
      take: 2,
    })
    if (matches.length === 1) {
      userRow = await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: "CLIENT",
          firmId: matches[0].firmId,
        },
        select: { firmId: true },
      })
    }
  }

  if (!userRow?.firmId) {
    throw new Error("Unauthorized: account is not linked to a firm")
  }

  session.user.firmId = userRow.firmId
  tenantContext.enterWith({ firmId: userRow.firmId })

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