"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { toUserError } from "@/lib/forms/errors"
import { requireAuth, requirePartner } from "@/lib/auth/guards"
import type { FormActionState } from "@/lib/forms/types"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { passwordSchema, profileSchema } from "@/lib/validations/settings"
import { getFirmSettings, upsertFirmSettings, type FirmConfig } from "@/lib/firm-settings"

export type NotificationPrefs = {
  email: boolean
  sms: boolean
  push: boolean
}

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

/**
 * Persist notification preferences in Supabase user_metadata.
 * No schema change required — stored as a JSON blob on the auth user.
 */
export async function saveNotificationPreferences(
  prefs: NotificationPrefs
): Promise<FormActionState> {
  try {
    await requireAuth()
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
      data: {
        notification_email: prefs.email,
        notification_sms: prefs.sms,
        notification_push: prefs.push,
      },
    })
    if (error) {
      return { error: "Failed to save notification preferences. Please try again." }
    }
    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to save preferences. Please try again." }
  }
}

/**
 * Read notification preferences from Supabase user_metadata.
 */
export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  await requireAuth()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return {
    email: user?.user_metadata?.notification_email ?? true,
    sms: user?.user_metadata?.notification_sms ?? false,
    push: user?.user_metadata?.notification_push ?? true,
  }
}

// ─── Firm Settings (PARTNER only) ────────────────────────────────────────────

const firmSettingsSchema = z.object({
  firmName: z.string().min(1, "Firm name is required").max(200),
  fromEmail: z.string().email("Valid sender email is required"),
  replyToEmail: z.string().email("Valid reply-to email required").optional().or(z.literal("")),
  firmPhone: z.string().max(30).optional().or(z.literal("")),
  firmAddress: z.string().max(500).optional().or(z.literal("")),
  gstin: z.string().max(15).optional().or(z.literal("")),
  pan: z.string().max(10).optional().or(z.literal("")),
  website: z.string().url("Enter a valid URL (https://...)").optional().or(z.literal("")),
})

export type FirmSettingsActionState = FormActionState

/**
 * Load firm settings — available to all authenticated staff so the settings
 * page can show current values to managers as read-only.
 */
export async function loadFirmSettings(): Promise<FirmConfig> {
  await requireAuth()
  return getFirmSettings()
}

/**
 * Save firm settings — PARTNER only.
 */
export async function saveFirmSettings(
  _prevState: FirmSettingsActionState,
  formData: FormData
): Promise<FirmSettingsActionState> {
  try {
    const session = await requirePartner()

    const raw = {
      firmName: formData.get("firmName"),
      fromEmail: formData.get("fromEmail"),
      replyToEmail: formData.get("replyToEmail") || undefined,
      firmPhone: formData.get("firmPhone") || undefined,
      firmAddress: formData.get("firmAddress") || undefined,
      gstin: formData.get("gstin") || undefined,
      pan: formData.get("pan") || undefined,
      website: formData.get("website") || undefined,
    }

    const parsed = firmSettingsSchema.safeParse(raw)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    await upsertFirmSettings(
      {
        firmName: parsed.data.firmName,
        fromEmail: parsed.data.fromEmail,
        replyToEmail: parsed.data.replyToEmail || null,
        firmPhone: parsed.data.firmPhone || null,
        firmAddress: parsed.data.firmAddress || null,
        gstin: parsed.data.gstin || null,
        pan: parsed.data.pan || null,
        website: parsed.data.website || null,
      },
      session.user.id
    )

    revalidatePath("/settings")
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "Only Partners can modify firm settings." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to save firm settings. Please try again." }
  }
}
