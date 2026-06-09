/** Strips trailing slashes and REST API paths from misconfigured URLs */
export function getSupabaseUrl(): string {
  // Must be a static reference so Next.js can inline NEXT_PUBLIC_* at compile time
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL")
  }
  return value.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "")
}

export function getSupabaseAnonKey(): string {
  // Must be a static reference so Next.js can inline NEXT_PUBLIC_* at compile time
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }
  return value
}
