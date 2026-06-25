"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { toUserError } from "@/lib/forms/errors"
import { requireAuth, requirePartner } from "@/lib/auth/guards"
import type { FormActionState } from "@/lib/forms/types"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { passwordSchema, profileSchema } from "@/lib/validations/settings"
import {
  getFirmSettings,
  upsertFirmSettings,
  extractDomain,
  buildDnsInstructions,
  type FirmConfig,
} from "@/lib/firm-settings"
import { randomBytes } from "crypto"
import { promises as dnsPromises } from "dns"

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
  platformFallbackEnabled: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean()
  ).optional(),
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
      platformFallbackEnabled: formData.get("platformFallbackEnabled") ?? undefined,
    }

    const parsed = firmSettingsSchema.safeParse(raw)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    // If the firm's sender email domain changes, reset verification status —
    // the new domain needs its own DNS proof.
    const existing = await getFirmSettings()
    const newDomain = extractDomain(parsed.data.fromEmail)
    const domainChanged = existing.firmDomain !== newDomain

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
        firmDomain: newDomain,
        ...(domainChanged
          ? {
              domainVerified: false,
              domainVerifiedAt: null,
              verificationToken: `jtacs-verify=${randomBytes(16).toString("hex")}`,
            }
          : {}),
        platformFallbackEnabled: parsed.data.platformFallbackEnabled ?? true,
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

// ─── Domain verification (Phase 8) ───────────────────────────────────────────

export type DnsRecord = {
  type: string
  host: string
  value: string
  purpose: string
  required: boolean
}

export type DomainVerificationStatus = {
  domain: string | null
  verified: boolean
  verifiedAt: Date | null
  records: DnsRecord[]
  checks: Array<{ type: string; host: string; found: boolean; detail: string }>
  usingFallback: boolean
}

/**
 * Return the current domain, the DNS records the firm must publish, and the
 * status of each check (which DNS records are already in place).
 * PARTNER-only — exposes verification tokens which gate sender identity.
 */
export async function getDomainVerificationStatus(): Promise<DomainVerificationStatus> {
  await requirePartner()
  const cfg = await getFirmSettings()

  const domain = cfg.firmDomain
  // Always have a verification token available so the UI can show it before
  // the first save.
  const token = cfg.verificationToken || ""

  if (!domain || !token) {
    return {
      domain,
      verified: cfg.domainVerified,
      verifiedAt: cfg.domainVerifiedAt,
      records: domain && token ? [...buildDnsInstructions(domain, token)] : [],
      checks: [],
      usingFallback: !cfg.domainVerified && cfg.platformFallbackEnabled,
    }
  }

  const records = [...buildDnsInstructions(domain, token)]

  // Perform DNS lookups against each required record.
  const checks: Array<{ type: string; host: string; found: boolean; detail: string }> = []
  for (const r of records) {
    try {
      if (r.type === "TXT") {
        const txt = await dnsPromises.resolveTxt(r.host)
        const flat = txt.map((c) => c.join("")).map((s) => s.trim())
        // For verification token check exact match; for SPF/DMARC be lenient
        const found =
          r.host.startsWith("_jtacs-verify.")
            ? flat.some((v) => v === r.value)
            : flat.some((v) => v.toLowerCase().includes(r.value.split(" ")[0].toLowerCase()))
        checks.push({
          type: r.type,
          host: r.host,
          found,
          detail: found ? "OK — record present" : `Expected: ${r.value}`,
        })
      } else if (r.type === "CNAME") {
        const cname = await dnsPromises.resolveCname(r.host)
        const found = cname.some((v) => v.toLowerCase().includes("resend"))
        checks.push({
          type: r.type,
          host: r.host,
          found,
          detail: found ? `OK — points to ${cname[0]}` : `Expected: ${r.value}`,
        })
      }
    } catch {
      checks.push({
        type: r.type,
        host: r.host,
        found: false,
        detail: "No record found at this host yet.",
      })
    }
  }

  return {
    domain,
    verified: cfg.domainVerified,
    verifiedAt: cfg.domainVerifiedAt,
    records,
    checks,
    usingFallback: !cfg.domainVerified && cfg.platformFallbackEnabled,
  }
}

/**
 * Inspect DNS, and if the required records (verification TXT, SPF, DKIM CNAME)
 * are all present, mark the domain as verified.
 */
export async function checkAndActivateDomainVerification(): Promise<{
  success: boolean
  verified: boolean
  message: string
  missing?: string[]
}> {
  try {
    const session = await requirePartner()
    const status = await getDomainVerificationStatus()

    if (!status.domain) {
      return {
        success: false,
        verified: false,
        message: "Set your firm's sender email first (Firm Details → Sender Email).",
      }
    }

    const requiredChecks = status.checks.filter((c) =>
      status.records.find((r) => r.host === c.host && r.type === c.type)?.required
    )
    const missing = requiredChecks.filter((c) => !c.found).map((c) => `${c.type} ${c.host}`)

    if (missing.length > 0) {
      return {
        success: true,
        verified: false,
        message: "DNS records not yet detected — propagation can take up to 48h.",
        missing,
      }
    }

    await upsertFirmSettings(
      {
        domainVerified: true,
        domainVerifiedAt: new Date(),
      },
      session.user.id
    )

    revalidatePath("/settings")
    return {
      success: true,
      verified: true,
      message: `Domain ${status.domain} verified — emails will now be sent directly from your firm's domain.`,
    }
  } catch (error) {
    return {
      success: false,
      verified: false,
      message: error instanceof Error ? error.message : "Verification check failed.",
    }
  }
}

/**
 * Force-rotate the verification token (e.g. user wants a fresh challenge value).
 */
export async function rotateVerificationToken(): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const session = await requirePartner()
    const token = `jtacs-verify=${randomBytes(16).toString("hex")}`
    await upsertFirmSettings(
      {
        verificationToken: token,
        domainVerified: false,
        domainVerifiedAt: null,
      },
      session.user.id
    )
    revalidatePath("/settings")
    return { success: true, token }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rotate token.",
    }
  }
}
