"use client"

import { createBrowserClient } from "@supabase/auth-helpers-nextjs"

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())
}
