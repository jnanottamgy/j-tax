"use server"

import { revalidatePath } from "next/cache"
import { toUserError } from "@/lib/forms/errors"
import { z } from "zod"

import { requireAuth } from "@/lib/auth/guards"
import type { FormActionState } from "@/lib/forms/types"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { passwordSchema, profileSchema } from "@/lib/validations/settings"

export type SettingsActionState = FormActionState

/**
 * Save profile name.
 * Updates both the Prisma User record and Supabase user_metadata so the
 * session reflects the new name immediately after the next sign-in refresh.
 */
export async function saveProfile(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    const session = await requireAuth()

    const raw = { name: formData.get("name") }
    const parsed = profileSchema.safeParse(raw)

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    // Update Prisma User record (upsert in case the record doesn't exist yet)
    await prisma.user.upsert({
      where: { id: session.user.id },
      update: { name: parsed.data.name },
      create: {
        id: session.user.id,
        email: session.user.email,
        name: parsed.data.name,
        role: session.user.role as any,
      },
    })

    // Also update Supabase user_metadata so the name is reflected in the JWT
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
      data: { name: parsed.data.name, full_name: parsed.data.name },
    })

    if (error) {
      // Non-fatal — Prisma record is already updated
      console.error("Failed to update Supabase user metadata:", error.message)
    }

    revalidatePath("/settings")
    revalidatePath("/", "layout")

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to save profile. Please try again." }
  }
}

/**
 * Change password via Supabase Auth.
 * Supabase handles current-password verification through re-authentication.
 */
export async function changePassword(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    await requireAuth()

    const raw = {
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    }

    const parsed = passwordSchema.safeParse(raw)

    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const supabase = await createClient()

    // Verify current password by attempting a sign-in with the stored email
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return { error: "Could not verify your identity. Please sign in again." }
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    })

    if (signInError) {
      return { fieldErrors: { currentPassword: ["Current password is incorrect."] } }
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.newPassword,
    })

    if (updateError) {
      return { error: "Failed to update password. Please try again." }
    }

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to change password. Please try again." }
  }
}
