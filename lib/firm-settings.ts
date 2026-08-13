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
import { currentFirmId } from "@/lib/tenant/context"

export type FirmConfig = {
  firmName: string
  fromEmail: string
  replyToEmail: string | null
  firmPhone: string | null
  firmAddress: string | null
  gstin: string | null
  pan: string | null
  website: string | null
  // ── Domain verification (mirrors Resend) ──────────────────────────────────
  firmDomain: string | null
  /** Mirrors Resend's status. Never asserted locally — see resend-domains.ts. */
  domainVerified: boolean
  domainVerifiedAt: Date | null
  /** Domain id in the platform's Resend account. */
  resendDomainId: string | null
  /** not_started | pending | verified | failed | temporary_failure */
  domainStatus: string | null
  /** @deprecated legacy token from the old self-certifying flow. */
  verificationToken: string | null
  platformFallbackEnabled: boolean
  // ── Payment collection details (client portal Pay dialog) ────────────────
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankIfsc: string | null
  bankName: string | null
  upiId: string | null
  // ── Delegation limits ────────────────────────────────────────────────────
  /**
   * Invoice value (incl. GST) above which a Manager needs Partner sign-off.
   * Null = no limit.
   */
  invoiceApprovalLimit: number | null
  // ── Letterhead ───────────────────────────────────────────────────────────
  /** Set iff a logo is stored. Doubles as the cache-buster for /api/firm/logo. */
  logoUpdatedAt: Date | null
  logoFileName: string | null
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
  resendDomainId: null,
  domainStatus: null,
  verificationToken: null,
  platformFallbackEnabled: true,
  bankAccountName: null,
  bankAccountNumber: null,
  bankIfsc: null,
  bankName: null,
  upiId: null,
  invoiceApprovalLimit: null,
  logoUpdatedAt: null,
  logoFileName: null,
}

/**
 * Every FirmConfig column — and pointedly NOT `logoData`.
 *
 * getFirmSettings() runs on dashboards, every outbound email and both PDF
 * routes. A `findUnique` with no select would drag a few hundred KB of base64
 * logo into memory on each of those, so the projection is spelled out and the
 * blob is fetched only by getFirmLogo().
 */
const FIRM_CONFIG_SELECT = {
  firmName: true,
  fromEmail: true,
  replyToEmail: true,
  firmPhone: true,
  firmAddress: true,
  gstin: true,
  pan: true,
  website: true,
  firmDomain: true,
  domainVerified: true,
  domainVerifiedAt: true,
  resendDomainId: true,
  domainStatus: true,
  verificationToken: true,
  platformFallbackEnabled: true,
  bankAccountName: true,
  bankAccountNumber: true,
  bankIfsc: true,
  bankName: true,
  upiId: true,
  invoiceApprovalLimit: true,
  logoUpdatedAt: true,
  logoFileName: true,
} as const

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
 * Which firm's settings are we reading/writing?
 *
 * `tenantContext` alone is not enough. `enterWith()` inside an awaited guard
 * does not survive the await boundary back into a server action or page — the
 * same reason lib/prisma.ts carries a resolver instead of trusting the store
 * (see lib/tenant/resolve.ts). Reading only the store made getFirmSettings()
 * silently return ENV_DEFAULTS and upsertFirmSettings() throw, so a firm could
 * complete onboarding and still see "Your Tax Firm" everywhere.
 *
 * Order matters: the explicit store wins, because cron loops set it per firm
 * via tenantContext.run() and there is no request cookie to fall back to.
 */
async function resolveFirmId(): Promise<string | null> {
  const fromStore = currentFirmId()
  if (fromStore) return fromStore
  const { resolveRequestFirmId } = await import("@/lib/tenant/resolve")
  return resolveRequestFirmId()
}

/**
 * Read firm settings from the database. Falls back to env vars if the row does
 * not exist yet (first-run before onboarding is complete).
 */
export async function getFirmSettings(): Promise<FirmConfig> {
  const firmId = await resolveFirmId()
  return getFirmSettingsForFirm(firmId)
}

/**
 * Settings for an explicitly-named firm.
 *
 * Needed by PUBLIC surfaces — the tokenised quotation portal and its PDF —
 * which have no session, so nothing can be derived from the request. They must
 * pass the firm that owns the record being displayed. Without this they fell
 * through to ENV_DEFAULTS and showed prospects "Your Tax Firm" instead of the
 * firm's actual name.
 */
export async function getFirmSettingsForFirm(
  firmId: string | null | undefined
): Promise<FirmConfig> {
  try {
    if (!firmId) return ENV_DEFAULTS

    const row = await prisma.firmSettings.findUnique({
      where: { firmId },
      select: FIRM_CONFIG_SELECT,
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
      resendDomainId: row.resendDomainId || null,
      domainStatus: row.domainStatus || null,
      verificationToken: row.verificationToken || null,
      platformFallbackEnabled: row.platformFallbackEnabled ?? true,
      bankAccountName: row.bankAccountName || null,
      bankAccountNumber: row.bankAccountNumber || null,
      bankIfsc: row.bankIfsc || null,
      bankName: row.bankName || null,
      upiId: row.upiId || null,
      invoiceApprovalLimit:
        row.invoiceApprovalLimit != null ? Number(row.invoiceApprovalLimit) : null,
      logoUpdatedAt: row.logoUpdatedAt ?? null,
      logoFileName: row.logoFileName || null,
    }
  } catch {
    return ENV_DEFAULTS
  }
}

export type FirmLogo = {
  /** Raw image bytes, ready for pdfkit's doc.image(). */
  data: Buffer
  mimeType: string
}

/**
 * The firm's letterhead bytes, or null when none is stored.
 *
 * Split out from getFirmSettings so the blob is loaded only where it is drawn
 * (the PDF generators and the /api/firm/logo route). Never throws — a firm
 * without a logo, or a row written before the column existed, simply renders
 * the wordmark header it always did.
 */
export async function getFirmLogoForFirm(
  firmId: string | null | undefined
): Promise<FirmLogo | null> {
  try {
    if (!firmId) return null
    const row = await prisma.firmSettings.findUnique({
      where: { firmId },
      select: { logoData: true, logoMimeType: true },
    })
    if (!row?.logoData || !row.logoMimeType) return null
    return { data: Buffer.from(row.logoData, "base64"), mimeType: row.logoMimeType }
  } catch {
    return null
  }
}

/** Logo for the firm in the current tenant context. */
export async function getFirmLogo(): Promise<FirmLogo | null> {
  return getFirmLogoForFirm(await resolveFirmId())
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
  const firmId = await resolveFirmId()
  if (!firmId) {
    throw new Error("Cannot save firm settings without a tenant context")
  }
  // The letterhead is owned by saveFirmLogo/removeFirmLogo — a details form
  // echoing its read-only fields back must never clear a stored logo.
  const { logoUpdatedAt: _lu, logoFileName: _lf, ...writable } = data
  const row = await prisma.firmSettings.upsert({
    where: { firmId },
    update: {
      ...writable,
      updatedBy,
    },
    create: {
      firmId,
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
      resendDomainId: data.resendDomainId ?? null,
      domainStatus: data.domainStatus ?? null,
      verificationToken: data.verificationToken ?? null,
      platformFallbackEnabled: data.platformFallbackEnabled ?? true,
      bankAccountName: data.bankAccountName ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankIfsc: data.bankIfsc ?? null,
      bankName: data.bankName ?? null,
      upiId: data.upiId ?? null,
      invoiceApprovalLimit: data.invoiceApprovalLimit ?? null,
      updatedBy,
    },
    select: FIRM_CONFIG_SELECT,
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
    resendDomainId: row.resendDomainId,
    domainStatus: row.domainStatus,
    verificationToken: row.verificationToken,
    platformFallbackEnabled: row.platformFallbackEnabled,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: row.bankAccountNumber,
    bankIfsc: row.bankIfsc,
    bankName: row.bankName,
    upiId: row.upiId,
    invoiceApprovalLimit:
      row.invoiceApprovalLimit != null ? Number(row.invoiceApprovalLimit) : null,
    logoUpdatedAt: row.logoUpdatedAt,
    logoFileName: row.logoFileName,
  }
}

/**
 * Store (or replace) the firm's letterhead. Caller must enforce PARTNER auth.
 * `data` is raw image bytes; they are base64-encoded for the text column.
 */
export async function saveFirmLogo(
  data: Buffer,
  mimeType: string,
  fileName: string | null,
  updatedBy: string
): Promise<Date> {
  const firmId = await resolveFirmId()
  if (!firmId) {
    throw new Error("Cannot save a logo without a tenant context")
  }
  const logoUpdatedAt = new Date()
  await prisma.firmSettings.upsert({
    where: { firmId },
    update: {
      logoData: data.toString("base64"),
      logoMimeType: mimeType,
      logoFileName: fileName,
      logoUpdatedAt,
      updatedBy,
    },
    create: {
      firmId,
      firmName: ENV_DEFAULTS.firmName,
      fromEmail: ENV_DEFAULTS.fromEmail,
      logoData: data.toString("base64"),
      logoMimeType: mimeType,
      logoFileName: fileName,
      logoUpdatedAt,
      updatedBy,
    },
  })
  return logoUpdatedAt
}

/** Drop the stored letterhead. Caller must enforce PARTNER auth. */
export async function removeFirmLogo(updatedBy: string): Promise<void> {
  const firmId = await resolveFirmId()
  if (!firmId) return
  await prisma.firmSettings.updateMany({
    where: { firmId },
    data: {
      logoData: null,
      logoMimeType: null,
      logoFileName: null,
      logoUpdatedAt: null,
      updatedBy,
    },
  })
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


