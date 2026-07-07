export const APP_ROLES = ["PARTNER", "MANAGER", "EMPLOYEE", "CLIENT"] as const

export type AppRole = (typeof APP_ROLES)[number]

export type AuthUser = {
  id: string
  email: string
  name: string
  role: AppRole
  /** Tenant id — resolved from the DB by requireAuth; absent pre-resolution. */
  firmId?: string
}

export type SessionInfo = {
  user: AuthUser
  /**
   * True when the account was provisioned with a temporary password and the
   * user has not yet chosen their own. Sensitive guards reject these sessions
   * so the forced-reset can't be skipped via /api or direct server actions.
   */
  mustChangePassword?: boolean
}
