import type { User } from "@supabase/supabase-js"

import { parseAppRole } from "@/lib/auth/roles"
import type { AuthUser, SessionInfo } from "@/lib/auth/types"
import { createClient } from "@/lib/supabase/server"

export function mapSupabaseUser(user: User): AuthUser | null {
  const role =
    parseAppRole(user.app_metadata?.role) ??
    parseAppRole(user.user_metadata?.role)

  if (!role) return null

  const email = user.email ?? ""
  const name =
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (typeof user.user_metadata?.full_name === "string" &&
      user.user_metadata.full_name) ||
    email.split("@")[0] ||
    "User"

  return {
    id: user.id,
    email,
    name,
    role,
  }
}

export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const mapped = mapSupabaseUser(user)
  if (!mapped) return null

  return { user: mapped }
}

export async function requireSession(): Promise<SessionInfo> {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}
