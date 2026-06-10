export const APP_ROLES = ["PARTNER", "MANAGER", "EMPLOYEE", "CLIENT"] as const

export type AppRole = (typeof APP_ROLES)[number]

export type AuthUser = {
  id: string
  email: string
  name: string
  role: AppRole
}

export type SessionInfo = {
  user: AuthUser
}
