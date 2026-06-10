/**
 * Firm Settings — canonical source of truth for all outbound email branding.
 *
 * Settings are stored in the `firm_settings` table (singleton row, id = "singleton").
 * Env vars (FIRM_NAME, FROM_EMAIL, etc.) are used as fallbacks when the DB record
 * has not been configured yet.
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
    }
  } catch {
    return ENV_DEFAULTS
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
  }
}
