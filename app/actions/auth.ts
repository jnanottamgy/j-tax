"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { loginSchema, signupSchema, resetPasswordSchema, newPasswordSchema } from "@/lib/validations/auth"
import { createClient } from "@/lib/supabase/server"

export type AuthActionState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  message?: string
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
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

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { error: "Invalid email or password. Please try again." }
    }
    return { error: error.message }
  }

  const redirectTo = formData.get("redirectTo")
  const destination =
    typeof redirectTo === "string" && redirectTo.startsWith("/")
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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.message.includes("User already registered")) {
      return { error: "An account with this email already exists." }
    }
    return { error: error.message }
  }

  // Note: In production, you might want to require email verification
  // before allowing the user to sign in. For now, we'll allow auto-confirm
  // if Supabase is configured that way.

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

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password/confirm`,
  })

  if (error) {
    return { error: error.message }
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
    return { error: error.message }
  }

  return {
    success: true,
    message: "Password updated successfully!",
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
