import type { AppRole } from "@/lib/auth/types"
import { APP_ROLES } from "@/lib/auth/types"

/** Higher number = more privileges */
export const ROLE_LEVEL: Record<AppRole, number> = {
  CLIENT: 0,
  EMPLOYEE: 1,
  MANAGER: 2,
  PARTNER: 3,
}

export const ROLE_LABELS: Record<AppRole, string> = {
  PARTNER: "Partner",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
  CLIENT: "Client",
}

/** Routes that require authentication */
export const PROTECTED_ROUTE_PREFIXES = [
  "/",
  "/clients",
  "/work-tracker",
  "/compliance",
  "/payments",
  "/calendar",
  "/employees",
  "/documents",
  "/messaging",
  "/reports",
  "/notifications",
  "/settings",
  "/activity",
  "/workforce",
  "/proposals",
] as const

/**
 * Minimum role required per route.
 *
 * Phase 2 RBAC hardening (Session 7):
 *  - /activity  → PARTNER only  (audit logs; Managers & Employees must not see firm-wide audit trail)
 *  - /workforce → PARTNER only  (employee intelligence; sensitive)
 *  - /payments  → PARTNER, MANAGER only
 *  - /employees → PARTNER, MANAGER only
 *  - /reports   → PARTNER, MANAGER only
 *  - /proposals → PARTNER, MANAGER only
 */
const STAFF_ROLES = ["PARTNER", "MANAGER", "EMPLOYEE"] as const satisfies readonly AppRole[]

export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  // Staff-only routes — CLIENT role is explicitly excluded from all staff routes
  "/": [...STAFF_ROLES],
  "/clients": [...STAFF_ROLES],
  "/work-tracker": [...STAFF_ROLES],
  "/compliance": [...STAFF_ROLES],
  "/payments": ["PARTNER", "MANAGER"],
  "/calendar": [...STAFF_ROLES],
  "/employees": ["PARTNER", "MANAGER"],
  "/documents": [...STAFF_ROLES],
  "/messaging": [...STAFF_ROLES],
  "/reports": ["PARTNER", "MANAGER"],
  "/notifications": [...STAFF_ROLES],
  "/settings": [...STAFF_ROLES],
  "/activity": ["PARTNER"],          // Audit logs — PARTNER only
  "/workforce": ["PARTNER"],         // Employee intelligence — PARTNER only
  "/proposals": ["PARTNER", "MANAGER"],
  "/docs": [...STAFF_ROLES],         // Help / setup documentation
  // Client portal — CLIENT role only
  "/client": ["CLIENT"],
}

export function parseAppRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null
  const normalized = value.toUpperCase()
  return APP_ROLES.includes(normalized as AppRole)
    ? (normalized as AppRole)
    : null
}

export function hasRole(
  userRole: AppRole,
  allowed: readonly AppRole[]
): boolean {
  return allowed.includes(userRole)
}

export function hasMinimumRole(userRole: AppRole, minimum: AppRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimum]
}

export function canAccessRoute(role: AppRole, pathname: string): boolean {
  const normalized =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname

  const allowed = ROUTE_ACCESS[normalized]
  if (!allowed) {
    const inheritedRoute = Object.keys(ROUTE_ACCESS)
      .filter(
        (route) =>
          route !== "/" &&
          (normalized === route || normalized.startsWith(`${route}/`))
      )
      .sort((a, b) => b.length - a.length)[0]

    if (inheritedRoute) {
      return hasRole(role, ROUTE_ACCESS[inheritedRoute])
    }

    const isProtected = PROTECTED_ROUTE_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )

    return isProtected ? hasRole(role, APP_ROLES) : true
  }

  return hasRole(role, allowed)
}
