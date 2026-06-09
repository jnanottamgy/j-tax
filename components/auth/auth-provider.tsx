"use client"

import { createContext, useContext, useMemo } from "react"

import type { AppRole, AuthUser } from "@/lib/auth/types"
import { hasMinimumRole, hasRole } from "@/lib/auth/roles"

type AuthContextValue = {
  user: AuthUser
  role: AppRole
  hasRole: (allowed: AppRole[]) => boolean
  hasMinimumRole: (minimum: AppRole) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser
  children: React.ReactNode
}) {
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user.role,
      hasRole: (allowed) => hasRole(user.role, allowed),
      hasMinimumRole: (minimum) => hasMinimumRole(user.role, minimum),
    }),
    [user]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
