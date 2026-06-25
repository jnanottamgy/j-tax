/**
 * Firm Settings — canonical source of truth for all outbound email branding.
 *
 * Settings live in the `firm_settings` table (singleton row, id = "singleton").
 * Env vars (FIRM_NAME, FROM_EMAIL, etc.) are fallbacks when the DB row has not
 * been configured yet — used during first-run before a PARTNER completes
 * onboarding.
 *
 * Phase 8 — Domain verification:
 *   firmDomain, domainVerified, domainVerifiedAt, verificationToken control
 *   whether outbound mail is sent from the firm's own domain (direct branded
 *   identity) or from the platform fallback domain (firm display name +
 *   firm Reply-To, but envelope-From is the platform).
 */
import { prisma } from "@/lib/prisma"

export type FirmConfig = {
  firmName: string
  fromEmail: string
  replyToEmail: string | null
  firmPhone: string | null
  firmAddress: string | null
  gstin: string | null
  pan: string | null
  website: string | null
  // ── Domain verification (Phase 8) ─────────────────────────────────────────
  firmDomain: string | null
  domainVerified: boolean
  domainVerifiedAt: Date | null
  verificationToken: string | null
  platformFallbackEnabled: boolean
}

const ENV_DEFAULTS: FirmConfig = {
  firmName: process.env.FIRM_NAME || "Your Tax Firm",
  fromEmail: process.env.FROM_EMAIL || "",
  replyToEmail: process.env.FROM_EMAIL || null,
  firmPhone: process.env.FIRM_PHONE || null,
  firmAddress: process.env.FIRM_ADDRESS || null,
  gstin: null,
  pan: null,
  website: null,
  firmDomain: null,
  domainVerified: false,
  domainVerifiedAt: null,
  verificationToken: null,
  platformFallbackEnabled: true,
}

/**
 * Platform fallback sender — used when the firm's own domain is not yet
 * verified with the email provider. Pulled from PLATFORM_FROM_EMAIL env var.
 * Falls back to FROM_EMAIL (which is what the firm has been configuring
 * historically), then a noreply@localhost address purely so the type-checker
 * is satisfied; an unset value blocks sends gracefully via resend-provider.
 */
export function getPlatformFallbackFrom(): string {
  return (
    process.env.PLATFORM_FROM_EMAIL ||
    process.env.FROM_EMAIL ||
    ""
  )
}

/**
 * Read firm settings from the database. Falls back to env vars if the singleton
 * row does not exist yet (first-run before onboarding is complete).
 */
export async function getFirmSettings(): Promise<FirmConfig> {
  try {
    const row = await prisma.firmSettings.findUnique({
      where: { id: "singleton" },
    })
    if (!row) return ENV_DEFAULTS

    return {
      firmName: row.firmName || ENV_DEFAULTS.firmName,
      fromEmail: row.fromEmail || ENV_DEFAULTS.fromEmail,
      replyToEmail: row.replyToEmail || ENV_DEFAULTS.replyToEmail,
      firmPhone: row.firmPhone || ENV_DEFAULTS.firmPhone,
      firmAddress: row.firmAddress || ENV_DEFAULTS.firmAddress,
      gstin: row.gstin || null,
      pan: row.pan || null,
      website: row.website || null,
      firmDomain: row.firmDomain || null,
      domainVerified: row.domainVerified ?? false,
      domainVerifiedAt: row.domainVerifiedAt ?? null,
      verificationToken: row.verificationToken || null,
      platformFallbackEnabled: row.platformFallbackEnabled ?? true,
    }
  } catch {
    return ENV_DEFAULTS
  }
}

/**
 * Decide the outbound sender envelope based on verification status.
 *
 * Returns:
 *   fromAddress  — formatted RFC-5322 sender header
 *   replyTo      — Reply-To header value (always firm reply-to / from if set)
 *   usingFallback — true if the platform fallback is in effect
 *   reason       — short human-readable explanation for diagnostics / banners
 */
export function resolveSenderEnvelope(cfg: FirmConfig): {
  fromAddress: string
  replyTo: string | null
  usingFallback: boolean
  reason: string
} {
  const replyTo = cfg.replyToEmail || cfg.fromEmail || null

  // Direct branded send — firm's own domain is verified.
  if (cfg.fromEmail && cfg.domainVerified) {
    return {
      fromAddress: `${cfg.firmName} <${cfg.fromEmail}>`,
      replyTo,
      usingFallback: false,
      reason: "Verified firm domain — direct branded send.",
    }
  }

  // Fallback: keep firm display name, send envelope-From from platform domain,
  // but always set Reply-To = firm email so replies route back to the firm.
  if (cfg.platformFallbackEnabled) {
    const platformFrom = getPlatformFallbackFrom()
    if (platformFrom) {
      return {
        fromAddress: `${cfg.firmName} <${platformFrom}>`,
        replyTo,
        usingFallback: true,
        reason: cfg.fromEmail
          ? "Firm domain not yet verified — sending via platform domain with firm branding and Reply-To."
          : "Firm sender email not configured — sending via platform domain with firm branding.",
      }
    }
  }

  // No verified domain, no fallback configured, no firm email — refuse to send.
  if (!cfg.fromEmail) {
    return {
      fromAddress: "",
      replyTo: null,
      usingFallback: false,
      reason:
        "Sender email not configured. Set it in Settings → Firm Details before email automation can be enabled.",
    }
  }

  // Last resort: send from firm address even if not verified. Some providers
  // (Resend) will reject if the address isn't a verified identity, so this
  // path may surface a provider error — that's the correct behavior.
  return {
    fromAddress: `${cfg.firmName} <${cfg.fromEmail}>`,
    replyTo,
    usingFallback: false,
    reason:
      "Firm domain not verified and platform fallback disabled — attempting direct send. Provider may reject.",
  }
}

/**
 * Persist firm settings. Only callable server-side; caller must enforce PARTNER auth.
 */
export async function upsertFirmSettings(
  data: Partial<Omit<FirmConfig, never>>,
  updatedBy: string
): Promise<FirmConfig> {
  const row = await prisma.firmSettings.upsert({
    where: { id: "singleton" },
    update: {
      ...data,
      updatedBy,
    },
    create: {
      id: "singleton",
      firmName: data.firmName || ENV_DEFAULTS.firmName,
      fromEmail: data.fromEmail || ENV_DEFAULTS.fromEmail,
      replyToEmail: data.replyToEmail ?? null,
      firmPhone: data.firmPhone ?? null,
      firmAddress: data.firmAddress ?? null,
      gstin: data.gstin ?? null,
      pan: data.pan ?? null,
      website: data.website ?? null,
      firmDomain: data.firmDomain ?? null,
      domainVerified: data.domainVerified ?? false,
      domainVerifiedAt: data.domainVerifiedAt ?? null,
      verificationToken: data.verificationToken ?? null,
      platformFallbackEnabled: data.platformFallbackEnabled ?? true,
      updatedBy,
    },
  })

  return {
    firmName: row.firmName,
    fromEmail: row.fromEmail,
    replyToEmail: row.replyToEmail,
    firmPhone: row.firmPhone,
    firmAddress: row.firmAddress,
    gstin: row.gstin,
    pan: row.pan,
    website: row.website,
    firmDomain: row.firmDomain,
    domainVerified: row.domainVerified,
    domainVerifiedAt: row.domainVerifiedAt,
    verificationToken: row.verificationToken,
    platformFallbackEnabled: row.platformFallbackEnabled,
  }
}

/**
 * Extract the domain portion of an email (lowercased).
 * Returns null for invalid input.
 */
export function extractDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf("@")
  // require non-empty local part AND non-empty domain part
  if (at <= 0 || at === email.length - 1) return null
  const dom = email.slice(at + 1).trim().toLowerCase()
  // basic sanity: must contain at least one dot and no whitespace
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom)) return null
  return dom
}

/**
 * Compute the suggested DNS records a firm must publish so their domain can
 * be used as a verified sender with Resend. SPF/DKIM values are stable per
 * Resend documentation; DMARC is recommended but optional.
 */
export function buildDnsInstructions(domain: string, verificationToken: string) {
  return [
    {
      type: "TXT",
      host: `_jtacs-verify.${domain}`,
      value: verificationToken,
      purpose: "Ownership verification — proves you control the domain.",
      required: true,
    },
    {
      type: "TXT",
      host: domain,
      value: "v=spf1 include:amazonses.com ~all",
      purpose: "SPF — authorizes Resend's mail servers to send for your domain.",
      required: true,
    },
    {
      type: "CNAME",
      host: `resend._domainkey.${domain}`,
      value: "resend._domainkey.resend.com",
      purpose: "DKIM — signs every outbound email so inbox providers can verify it.",
      required: true,
    },
    {
      type: "TXT",
      host: `_dmarc.${domain}`,
      value: "v=DMARC1; p=none; rua=mailto:dmarc@" + domain,
      purpose: "DMARC — tells receivers what to do with mail that fails SPF/DKIM. Start with p=none, tighten later.",
      required: false,
    },
  ] as const
}
