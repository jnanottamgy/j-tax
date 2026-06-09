function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/** Strips trailing slashes and API paths from misconfigured URLs */
export function getSupabaseUrl(): string {
  const raw = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "")
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
}
