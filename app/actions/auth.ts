"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { loginSchema, signupSchema, resetPasswordSchema, newPasswordSchema } from "@/lib/validations/auth"
import { createClient } from "@/lib/supabase/server"
import { checkLoginRateLimit } from "@/lib/security/rate-limiter"
import { logLoginSuccess, logLoginFailure } from "@/lib/security/audit-logger"
import { parseAppRole } from "@/lib/auth/roles"
import { reportError } from "@/lib/observability/report-error"

export type AuthActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  message?: string
  /** Optional structured payload for the caller's UI (e.g. confirm-email flag). */
  data?: Record<string, unknown>
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

/**
 * redirect() and notFound() work by throwing. They must reach the framework.
 */
function isControlFlowError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    ((err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (err as { digest: string }).digest === "NEXT_NOT_FOUND")
  )
}

/**
 * Nothing thrown out of an auth action is ever useful to the person in front of
 * it. Signing in and signing up are the two things a customer does before they
 * can do anything else, and an exception escaping either one renders the blank
 * "Something went wrong" boundary — no message, no cause, and a reference
 * number that means nothing without server-log access.
 *
 * So these actions return failures instead of throwing them, and name the cause
 * where it can be told apart. The full error still goes to the server log with
 * the same reference the user is shown.
 */
function authFailure(err: unknown, source: string): AuthActionState {
  const ref = reportError(err, { source, severity: "fatal" })
  const message = err instanceof Error ? err.message : String(err)

  // The Supabase client throws rather than returning an error when the request
  // never reaches the API at all — wrong project URL, DNS, blocked egress.
  if (
    /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|AuthRetryableFetchError/i.test(
      message
    )
  ) {
    return {
      error:
        "Could not reach the sign-in service. Check NEXT_PUBLIC_SUPABASE_URL " +
        `and that the server has outbound network access. (Ref: ${ref})`,
    }
  }

  // Prisma could not connect, or the database is missing something the client
  // expects — the signature of a schema that was never pushed.
  if (/P1001|P1000|P1017|P2021|P2022|Can't reach database|does not exist/i.test(message)) {
    return {
      error:
        "Could not reach the database, or its schema is out of date. Run " +
        `npm run db:check, then npx prisma db push. (Ref: ${ref})`,
    }
  }

  return {
    error: `Something went wrong on our side. Quote this to support: ${ref}`,
  }
}

export async function signIn(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    return await signInInner(prevState, formData)
  } catch (err) {
    if (isControlFlowError(err)) throw err
    return authFailure(err, "signin")
  }
}

async function signInInner(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const ip = await getClientIp()

  // Login rate limiting temporarily disabled — was locking out legitimate
  // users (whole offices share an IP). Re-add with IP+email keying later.

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

  // Provisioned accounts must set their own password before using the app
  if (data.user?.user_metadata?.must_change_password) {
    revalidatePath("/", "layout")
    redirect("/auth/set-password")
  }

  // CLIENT users must always go to the client portal, never the staff app
  const userRole =
    parseAppRole(data.user?.app_metadata?.role) ??
    parseAppRole(data.user?.user_metadata?.role)

  if (userRole === "CLIENT") {
    revalidatePath("/", "layout")
    redirect("/client")
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

/**
 * SaaS signup — every registration creates a brand-new FIRM (tenant) with the
 * registrant as its founding Partner on a 14-day trial. Staff inside a firm
 * are still provisioned from the Employees page and inherit that firm; data
 * isolation between firms is enforced centrally in lib/prisma.ts.
 */
export async function signUp(
  prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  try {
    return await signUpInner(prevState, formData)
  } catch (err) {
    if (isControlFlowError(err)) throw err
    return authFailure(err, "signup")
  }
}

async function signUpInner(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // Rate-limit signups per IP to prevent automated account-creation abuse.
  const ip = await getClientIp()
  const rateLimit = checkLoginRateLimit(ip)
  if (!rateLimit.success) {
    return {
      error: `Too many attempts. Please try again in ${rateLimit.retryAfter ?? 60} seconds.`,
    }
  }

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    firmName: formData.get("firmName"),
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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name,
        // Public signup is for firm owners — team members are provisioned by
        // the Partner from the Employees page and get EMPLOYEE/MANAGER roles.
        role: "PARTNER",
        // Kept on the auth account so that if firm provisioning below fails,
        // the recovery path in requireAuth can still create the firm they
        // actually typed rather than inventing a name for it.
        firm_name: parsed.data.firmName.trim(),
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

  // Provision the tenant: new Firm (14-day trial) + its settings row + the
  // founding Partner's user record, atomically. If this fails, the auth user
  // exists but has no firm — requireAuth rejects such sessions, so the
  // account can't limp into a half-provisioned state.
  if (data.user) {
    try {
      const { provisionFirmForPartner } = await import("@/lib/auth/provision-firm")
      await provisionFirmForPartner({
        userId: data.user.id,
        email: parsed.data.email,
        name: parsed.data.name,
        firmName: parsed.data.firmName,
      })
    } catch (err) {
      console.error("[signup] firm provisioning failed:", err)
      // Not a dead end any more. The auth account exists and carries the firm
      // name, so signing in finishes the job — say so, instead of sending them
      // back to a signup form that will now refuse the email as taken.
      return {
        error:
          "Your account was created, but setting up the firm did not finish. " +
          "Please sign in — it will complete automatically.",
      }
    }
  }

  // Supabase only sends a confirmation email when it's enabled for the
  // project; detect that case so the UI can tell the user the right next step.
  const needsEmailConfirm = !data.session

  return {
    success: true,
    message: needsEmailConfirm
      ? "Account created! Check your email and click the confirmation link before signing in."
      : "Account created successfully! You can sign in now.",
    data: { needsEmailConfirm },
  }
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // Rate-limit password-reset by IP so we don't become a free email-blast tool.
  // Reuses the same limiter bucket as login so 5/min per IP applies across both.
  const ip = await getClientIp()
  const rateLimit = checkLoginRateLimit(ip)
  if (!rateLimit.success) {
    return {
      error: `Too many requests. Please try again in ${rateLimit.retryAfter ?? 60} seconds.`,
    }
  }

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
    // Clear the first-login flag set by staff provisioning (no-op otherwise).
    data: { must_change_password: false },
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
