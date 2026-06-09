import type { AppRole } from "@/lib/auth/types"
import { APP_ROLES } from "@/lib/auth/types"

/** Higher number = more privileges */
export const ROLE_LEVEL: Record<AppRole, number> = {
  CLIENT: 0,
  EXECUTIVE: 1,
  MANAGER: 2,
  PARTNER: 3,
}

export const ROLE_LABELS: Record<AppRole, string> = {
  PARTNER: "Partner",
  MANAGER: "Manager",
  EXECUTIVE: "Executive",
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
] as const

/** Minimum role required per route (most permissive list) */
export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/": [...APP_ROLES],
  "/clients": [...APP_ROLES],
  "/work-tracker": [...APP_ROLES],
  "/compliance": [...APP_ROLES],
  "/payments": ["PARTNER", "MANAGER"],
  "/calendar": [...APP_ROLES],
  "/employees": ["PARTNER", "MANAGER"],
  "/documents": [...APP_ROLES],
  "/messaging": [...APP_ROLES],
  "/reports": ["PARTNER", "MANAGER"],
  "/notifications": [...APP_ROLES],
  "/settings": [...APP_ROLES],
  "/activity": [...APP_ROLES],
  "/workforce": ["PARTNER"],
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
