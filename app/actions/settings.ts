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
  getPlatformFallbackFrom,
  resolveSenderEnvelope,
  type FirmConfig,
} from "@/lib/firm-settings"
import {
  ensureDomain,
  fetchDomain,
  findDomainByName,
  requestVerification,
  type ResendDomainStatus,
} from "@/lib/messaging/resend-domains"
import { resendProvider } from "@/lib/messaging/resend-provider"

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
  // Payment collection details — shown to clients in the portal Pay dialog
  bankName: z.string().max(100).optional().or(z.literal("")),
  bankAccountName: z.string().max(200).optional().or(z.literal("")),
  bankAccountNumber: z.string().max(30).optional().or(z.literal("")),
  bankIfsc: z.string().max(11).optional().or(z.literal("")),
  upiId: z.string().max(100).optional().or(z.literal("")),
  // ICAI identity. The FRN belongs on every audit report and certificate;
  // the membership number is what the UDIN portal is keyed on.
  icaiFrn: z.string().max(20).optional().or(z.literal("")),
  icaiMembershipNo: z.string().max(20).optional().or(z.literal("")),
  // Blank = no limit. Coerced from the form string; a non-numeric entry
  // fails validation rather than silently becoming "no limit".
  invoiceApprovalLimit: z
    .string()
    .optional()
    .refine((v) => !v?.trim() || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: "Enter an amount in rupees, or leave blank for no limit.",
    }),
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
      bankName: formData.get("bankName") || undefined,
      bankAccountName: formData.get("bankAccountName") || undefined,
      bankAccountNumber: formData.get("bankAccountNumber") || undefined,
      bankIfsc: formData.get("bankIfsc") || undefined,
      upiId: formData.get("upiId") || undefined,
      icaiFrn: formData.get("icaiFrn") || undefined,
      icaiMembershipNo: formData.get("icaiMembershipNo") || undefined,
      invoiceApprovalLimit: formData.get("invoiceApprovalLimit") || undefined,
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
        // A new sender domain is a different identity and must be registered
        // and verified with Resend from scratch — drop the old linkage so we
        // never poll the previous domain's id.
        ...(domainChanged
          ? {
              domainVerified: false,
              domainVerifiedAt: null,
              resendDomainId: null,
              domainStatus: null,
            }
          : {}),
        platformFallbackEnabled: parsed.data.platformFallbackEnabled ?? true,
        bankName: parsed.data.bankName || null,
        bankAccountName: parsed.data.bankAccountName || null,
        bankAccountNumber: parsed.data.bankAccountNumber || null,
        bankIfsc: parsed.data.bankIfsc || null,
        upiId: parsed.data.upiId || null,
        icaiFrn: parsed.data.icaiFrn?.trim().toUpperCase() || null,
        icaiMembershipNo: parsed.data.icaiMembershipNo?.trim() || null,
        invoiceApprovalLimit: parsed.data.invoiceApprovalLimit?.trim()
          ? Number(parsed.data.invoiceApprovalLimit)
          : null,
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


// ─── Domain verification (Resend-backed) ─────────────────────────────────────

export type DnsRecord = {
  type: string
  host: string
  value: string
  priority?: number
  purpose: string
  required: boolean
  /** Per-record state as reported by Resend, once it has begun checking. */
  status?: string
}

export type DomainVerificationStatus = {
  domain: string | null
  verified: boolean
  verifiedAt: Date | null
  /** Raw Resend lifecycle state — drives the UI wording. */
  providerStatus: ResendDomainStatus | null
  records: DnsRecord[]
  usingFallback: boolean
  /** Populated when the domain could not be registered/read at Resend. */
  error?: string
  /** True when the blocker is server configuration, not the firm's DNS. */
  configError?: boolean
}

/** Human-readable purpose per Resend record type. */
function describeRecord(record: string, type: string): string {
  if (record.toUpperCase().includes("DKIM")) {
    return "DKIM — signs every outbound email with a key unique to your domain so inbox providers can verify it."
  }
  if (type === "MX") {
    return "MX — lets Resend receive bounce and complaint feedback for your domain."
  }
  return "SPF — authorises Resend's mail servers to send on behalf of your domain."
}

/**
 * Register the firm's sender domain with Resend (idempotently) and return the
 * EXACT DNS records Resend generated, plus Resend's own verification status.
 *
 * These records are never hand-authored: the DKIM key is unique per domain, so
 * only Resend can issue them, and only Resend can mark a domain verified.
 *
 * PARTNER-only — the records are sender-identity material.
 */
export async function getDomainVerificationStatus(): Promise<DomainVerificationStatus> {
  await requirePartner()
  const cfg = await getFirmSettings()
  const domain = cfg.firmDomain

  const base = {
    domain,
    verified: cfg.domainVerified,
    verifiedAt: cfg.domainVerifiedAt,
    providerStatus: (cfg.domainStatus as ResendDomainStatus | null) ?? null,
    records: [] as DnsRecord[],
    usingFallback: !cfg.domainVerified && cfg.platformFallbackEnabled,
  }

  if (!domain) return base

  const result = await ensureDomain(domain, cfg.resendDomainId)
  if (!result.ok) {
    return { ...base, error: result.error, configError: result.configError }
  }

  const { domain: remote } = result.data
  const verified = remote.status === "verified"

  // Persist whatever Resend told us so the rest of the app (send envelope,
  // banners) reads a status that reflects reality rather than our own guess.
  if (
    remote.id !== cfg.resendDomainId ||
    remote.status !== cfg.domainStatus ||
    verified !== cfg.domainVerified
  ) {
    await upsertFirmSettings(
      {
        resendDomainId: remote.id,
        domainStatus: remote.status,
        domainVerified: verified,
        domainVerifiedAt: verified ? (cfg.domainVerifiedAt ?? new Date()) : null,
      },
      "system"
    )
  }

  return {
    domain,
    verified,
    verifiedAt: verified ? (cfg.domainVerifiedAt ?? new Date()) : null,
    providerStatus: remote.status,
    records: remote.records.map((r) => ({
      type: r.type,
      host: r.host,
      value: r.value,
      ...(r.priority !== undefined ? { priority: r.priority } : {}),
      purpose: describeRecord(r.record, r.type),
      required: true,
      ...(r.status ? { status: r.status } : {}),
    })),
    usingFallback: !verified && cfg.platformFallbackEnabled,
  }
}

/**
 * Ask Resend to re-check the firm's DNS now, then read back the resulting
 * status. We never decide verification ourselves — we relay Resend's answer.
 */
export async function checkAndActivateDomainVerification(): Promise<{
  success: boolean
  verified: boolean
  message: string
  pending?: boolean
}> {
  try {
    await requirePartner()
    const cfg = await getFirmSettings()

    if (!cfg.firmDomain) {
      return {
        success: false,
        verified: false,
        message: "Set your firm's sender email first (Firm Details → Sender Email).",
      }
    }

    const ensured = await ensureDomain(cfg.firmDomain, cfg.resendDomainId)
    if (!ensured.ok) {
      return {
        success: false,
        verified: false,
        message: ensured.configError
          ? `Email provider not configured on the server: ${ensured.error}`
          : ensured.error,
      }
    }

    // Trigger a re-check, then re-read. Resend updates asynchronously, so a
    // freshly-published record often reports `pending` on the first click.
    await requestVerification(ensured.data.domain.id)
    const after = await fetchDomain(ensured.data.domain.id)
    const status = after.ok ? after.data.status : ensured.data.domain.status
    const verified = status === "verified"

    await upsertFirmSettings(
      {
        resendDomainId: ensured.data.domain.id,
        domainStatus: status,
        domainVerified: verified,
        domainVerifiedAt: verified ? new Date() : null,
      },
      "system"
    )

    revalidatePath("/settings")

    if (verified) {
      return {
        success: true,
        verified: true,
        message: `${cfg.firmDomain} is verified — email now sends directly from your firm's address.`,
      }
    }

    if (status === "failed") {
      return {
        success: true,
        verified: false,
        message:
          "Resend could not validate the records. Check each value matches exactly, then try again.",
      }
    }

    return {
      success: true,
      verified: false,
      pending: true,
      message:
        "Records submitted — Resend is checking them. DNS changes usually apply within 10 minutes (up to 48h). Your email keeps sending via the platform address meanwhile.",
    }
  } catch (error) {
    return {
      success: false,
      verified: false,
      message: error instanceof Error ? error.message : "Verification check failed.",
    }
  }
}

// ─── Email delivery diagnostics ──────────────────────────────────────────────

export type EmailCheck = {
  label: string
  ok: boolean
  /** Blocking failures stop mail entirely; non-blocking ones only degrade branding. */
  blocking: boolean
  detail: string
}

export type EmailDiagnostics = {
  /** The exact From header outbound mail would use right now. */
  effectiveFrom: string
  replyTo: string | null
  usingFallback: boolean
  canSend: boolean
  checks: EmailCheck[]
}

/**
 * Explain, in one place, whether outbound email can actually be delivered and
 * what is blocking it.
 *
 * This exists because failures were previously invisible: an invite would
 * silently not arrive with no indication whether the API key was missing, the
 * sender domain was unverified at the provider, or the fallback was unset.
 */
export async function getEmailDeliveryDiagnostics(): Promise<EmailDiagnostics> {
  await requirePartner()
  const cfg = await getFirmSettings()
  const envelope = resolveSenderEnvelope(cfg)
  const checks: EmailCheck[] = []

  const hasKey = Boolean(process.env.RESEND_API_KEY)
  checks.push({
    label: "Email provider key",
    ok: hasKey,
    blocking: true,
    detail: hasKey
      ? "RESEND_API_KEY is configured on the server."
      : "RESEND_API_KEY is not set. No email of any kind can be sent until it is.",
  })

  checks.push({
    label: "Firm sender address",
    ok: Boolean(cfg.fromEmail),
    blocking: false,
    detail: cfg.fromEmail
      ? `Firm address is ${cfg.fromEmail}. Replies route here.`
      : "No sender address set (Firm Details → Sender Email). Mail still sends via the platform address, but replies have nowhere to go.",
  })

  // The fallback is what carries mail on day one, before any DNS work. If it
  // is not a verified identity at the provider, EVERY send is rejected — this
  // is the most common cause of "nothing arrives".
  const platformFrom = getPlatformFallbackFrom()
  const platformDomain = platformFrom.split("@")[1] ?? ""
  let platformOk = Boolean(platformFrom)
  let platformDetail = platformFrom
    ? `Platform sender is ${platformFrom}.`
    : "No platform sender configured (PLATFORM_FROM_EMAIL). Firms without a verified domain cannot send at all."

  if (hasKey && platformDomain) {
    const lookup = await findDomainByName(platformDomain)
    if (lookup.ok) {
      const verified = lookup.data?.status === "verified"
      platformOk = verified
      platformDetail = verified
        ? `Platform sender ${platformFrom} is on a verified domain — mail sends today with no DNS work.`
        : lookup.data
          ? `Platform domain ${platformDomain} is registered but NOT verified (status: ${lookup.data.status}). Every send will be rejected until it is.`
          : `Platform domain ${platformDomain} is not registered with the email provider. Every send will be rejected until it is.`
    } else {
      platformDetail = `Could not check the platform domain: ${lookup.error}`
      platformOk = false
    }
  }

  checks.push({
    label: "Platform fallback sender",
    ok: platformOk,
    blocking: !cfg.domainVerified,
    detail: platformDetail,
  })

  checks.push({
    label: "Firm domain verification",
    ok: cfg.domainVerified,
    blocking: false,
    detail: cfg.domainVerified
      ? `${cfg.firmDomain} is verified — mail sends directly from your own domain.`
      : cfg.firmDomain
        ? `${cfg.firmDomain} is not verified yet (status: ${cfg.domainStatus ?? "not started"}). Mail still goes out via the platform address with your firm's name and Reply-To.`
        : "No firm domain yet. Optional — mail sends via the platform address meanwhile.",
  })

  const blockingFailure = checks.some((c) => c.blocking && !c.ok)

  return {
    effectiveFrom: envelope.fromAddress || "(not configured)",
    replyTo: envelope.replyTo,
    usingFallback: envelope.usingFallback,
    canSend: Boolean(envelope.fromAddress) && !blockingFailure,
    checks,
  }
}

/**
 * Send a real message through the live provider and report the verbatim
 * outcome. The only reliable way to answer "why didn't the invite arrive?".
 */
export async function sendTestEmail(
  to: string
): Promise<{ success: boolean; message: string; from?: string }> {
  try {
    await requirePartner()

    const target = to?.trim()
    if (!target || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      return { success: false, message: "Enter a valid email address to send the test to." }
    }

    const cfg = await getFirmSettings()
    const envelope = resolveSenderEnvelope(cfg)

    const result = await resendProvider.send({
      to: target,
      subject: `Test email from ${cfg.firmName}`,
      content:
        `<p>This is a test message from your ${cfg.firmName} workspace.</p>` +
        `<p>If you are reading this, outbound email is working. Sent as ` +
        `<strong>${envelope.fromAddress}</strong>.</p>`,
      metadata: { kind: "delivery_test" },
    })

    if (!result.success) {
      return {
        success: false,
        from: envelope.fromAddress,
        message: result.error ?? "The email provider rejected the message.",
      }
    }

    return {
      success: true,
      from: envelope.fromAddress,
      message: `Test email accepted by the provider and sent to ${target}. If it does not arrive within a few minutes, check the recipient's spam folder.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Test send failed.",
    }
  }
}
