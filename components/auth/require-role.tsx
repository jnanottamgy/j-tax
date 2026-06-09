import { redirect } from "next/navigation"

import type { AppRole } from "@/lib/auth/types"
import { hasRole } from "@/lib/auth/roles"
import { getSession } from "@/lib/auth/session"

type RequireRoleProps = {
  allowedRoles: AppRole[]
  children: React.ReactNode
}

export async function RequireRole({
  allowedRoles,
  children,
}: RequireRoleProps) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  if (!hasRole(session.user.role, allowedRoles)) {
    redirect("/unauthorized")
  }

  return <>{children}</>
}
