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
  "/compliance-calendar",
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
  "/templates",
  "/timesheet",
  "/registers",
  "/groups",
  "/trash",
  "/gst-reconciliation",
  "/itr-computation",
  "/notices",
  "/financial-statements",
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
  "/compliance": ["PARTNER", "MANAGER"], // Compliance Operations — management only
  "/compliance-calendar": ["PARTNER", "MANAGER"], // Statutory calendar — management only
  "/payments": ["PARTNER"],             // Payment analytics dashboard — PARTNER only
  "/payments/invoices": ["PARTNER", "MANAGER"], // Invoices list — managers keep this
  "/calendar": [...STAFF_ROLES],
  "/employees": ["PARTNER", "MANAGER"],
  "/documents": [...STAFF_ROLES],
  "/messaging": [...STAFF_ROLES],
  "/reports": ["PARTNER", "MANAGER"],
  "/notifications": [...STAFF_ROLES],
  "/settings": [...STAFF_ROLES],
  "/activity": ["PARTNER"],          // Audit logs — PARTNER only
  "/workforce": ["PARTNER", "MANAGER"], // Team performance — managers run the team day-to-day
  "/proposals": ["PARTNER", "MANAGER"],
  "/docs": [...STAFF_ROLES],         // Help / setup documentation
  "/templates": ["PARTNER", "MANAGER"], // Job templates — define firm workflows
  "/timesheet": [...STAFF_ROLES],       // Time tracking — every staff member
  "/registers": ["PARTNER", "MANAGER"], // Credential vault + DSC/UDIN/registrations
  "/groups": ["PARTNER", "MANAGER"],    // Client groups — full-roster view, management only
  "/trash": ["PARTNER", "MANAGER"],     // Recycle bin — restore/purge
  "/gst-reconciliation": [...STAFF_ROLES], // GSTR-2B ↔ purchase register workbench
  "/itr-computation": [...STAFF_ROLES],    // ITR old-vs-new regime computation sheets
  "/notices": [...STAFF_ROLES],            // Tax notice & litigation register
  "/financial-statements": [...STAFF_ROLES], // Schedule III statements from TB import
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
