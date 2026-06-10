"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { loginSchema, signupSchema, resetPasswordSchema, newPasswordSchema } from "@/lib/validations/auth"
import { createClient } from "@/lib/supabase/server"
import { checkLoginRateLimit } from "@/lib/security/rate-limiter"
import { logLoginSuccess, logLoginFailure } from "@/lib/security/audit-logger"

export type AuthActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  message?: string
}

// CRIT-01: Only allow same-origin relative paths — rejects //evil.com and absolute URLs
function isSafeRedirectPath(value: string): boolean {
  if (!value.startsWith("/")) return false
  // Reject protocol-relative URLs like //evil.com
  if (value.startsWith("//")) return false
  // Reject anything that contains a host component
  try {
    const parsed = new URL(value, "https://placeholder.invalid")
    return parsed.origin === "https://placeholder.invalid"
  } catch {
    return false
  }
}

async function getClientIp(): Promise<string> {
  const h = await headers()
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown"
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const ip = await getClientIp()

  // HIGH-02: Enforce rate limiting on login
  const rateLimit = checkLoginRateLimit(ip)
  if (!rateLimit.success) {
    return {
      error: `Too many login attempts. Please try again in ${rateLimit.retryAfter ?? 60} seconds.`,
    }
  }

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  }

  const parsed = loginSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // MED-04: Log failed login to audit trail
    await logLoginFailure(parsed.data.email, ip, error.message)
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { error: "Invalid email or password. Please try again." }
    }
    return { error: "Sign in failed. Please try again." }
  }

  // MED-04: Log successful login to audit trail
  if (data.user) {
    await logLoginSuccess(data.user.id, data.user.email ?? "", ip)

    // Workforce: start session + track LOGIN activity
    try {
      const { startEmployeeSession, getEmployeeByUserId, trackEmployeeActivity } = await import("@/lib/workforce/tracker")
      const employee = await getEmployeeByUserId(data.user.id)
      if (employee) {
        const h = await headers()
        const ua = h.get("user-agent") ?? undefined
        await startEmployeeSession(employee.id, data.user.id, ip, ua)
        await trackEmployeeActivity({
          employeeId: employee.id,
          userId: data.user.id,
          activityType: "LOGIN",
          description: "Logged in",
        })
      }
    } catch (err) {
      console.error("[workforce] login tracking error:", err)
    }
  }

  // CRIT-01: Validate redirectTo is a safe same-origin path
  const redirectTo = formData.get("redirectTo")
  const destination =
    typeof redirectTo === "string" && isSafeRedirectPath(redirectTo)
      ? redirectTo
      : "/"

  revalidatePath("/", "layout")
  redirect(destination)
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    confirmPassword: formData.get("confirmPassword"),
  }

  const parsed = signupSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  // HIGH-03: Fall back to origin header if NEXT_PUBLIC_APP_URL is not set
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (await headers()).get("origin") ||
    "http://localhost:3000"

  const { data: _data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name,
      },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.includes("User already registered")) {
      return { error: "An account with this email already exists." }
    }
    return { error: "Sign up failed. Please try again." }
  }

  return {
    success: true,
    message: "Account created successfully! Please check your email to verify your account.",
  }
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const raw = {
    email: formData.get("email"),
  }

  const parsed = resetPasswordSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  // HIGH-03: Fall back to origin header if NEXT_PUBLIC_APP_URL is not set
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (await headers()).get("origin") ||
    "http://localhost:3000"

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/reset-password/confirm`,
  })

  if (error) {
    return { error: "Failed to send reset email. Please try again." }
  }

  return {
    success: true,
    message: "Password reset link sent to your email. Please check your inbox.",
  }
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const raw = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  }

  const parsed = newPasswordSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { error: "Failed to update password. Please try again." }
  }

  return {
    success: true,
    message: "Password updated successfully!",
  }
}

export async function signOut(): Promise<void> {
  // Workforce: end session + track LOGOUT
  try {
    const { getSession } = await import("@/lib/auth/session")
    const session = await getSession()
    if (session) {
      const { endEmployeeSession, getEmployeeByUserId, trackEmployeeActivity } = await import("@/lib/workforce/tracker")
      const employee = await getEmployeeByUserId(session.user.id)
      if (employee) {
        await trackEmployeeActivity({
          employeeId: employee.id,
          userId: session.user.id,
          activityType: "LOGOUT",
          description: "Logged out",
        })
        await endEmployeeSession(employee.id)
      }
    }
  } catch (err) {
    console.error("[workforce] logout tracking error:", err)
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
