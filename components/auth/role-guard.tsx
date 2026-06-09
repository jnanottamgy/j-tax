"use client"

import type { AppRole } from "@/lib/auth/types"
import { useAuth } from "@/components/auth/auth-provider"

type RoleGuardProps = {
  allowedRoles: AppRole[]
  minimumRole?: AppRole
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGuard({
  allowedRoles,
  minimumRole,
  children,
  fallback = null,
}: RoleGuardProps) {
  const { hasRole, hasMinimumRole } = useAuth()

  const allowed = minimumRole
    ? hasMinimumRole(minimumRole) && hasRole(allowedRoles)
    : hasRole(allowedRoles)

  if (!allowed) return <>{fallback}</>
  return <>{children}</>
}
