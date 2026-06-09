import { createServerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // setAll can fail in Server Components; middleware refreshes sessions.
        }
      },
    },
  })
}
