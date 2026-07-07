/**
 * Shared constants for the credential vault and statutory registers.
 * Client-safe — imported by both server actions and "use client" components
 * ("use server" files may only export async functions, so consts live here).
 */

export const CREDENTIAL_PORTALS = [
  "GST",
  "INCOME_TAX",
  "TRACES",
  "MCA",
  "EPFO",
  "ESIC",
  "ICEGATE",
  "PT",
  "OTHER",
] as const

export type CredentialPortal = (typeof CREDENTIAL_PORTALS)[number]

export const CREDENTIAL_PORTAL_LABELS: Record<CredentialPortal, string> = {
  GST: "GST",
  INCOME_TAX: "Income Tax",
  TRACES: "TRACES",
  MCA: "MCA",
  EPFO: "EPFO",
  ESIC: "ESIC",
  ICEGATE: "ICEGATE",
  PT: "Professional Tax",
  OTHER: "Other",
}

export const REGISTRATION_TYPES = [
  "GST",
  "PT",
  "IEC",
  "MSME_UDYAM",
  "FSSAI",
  "SHOPS_ESTAB",
  "PF",
  "ESIC",
  "DIN",
  "LLPIN",
  "CIN",
  "TAN",
  "OTHER",
] as const

export type RegistrationType = (typeof REGISTRATION_TYPES)[number]

export const REGISTRATION_TYPE_LABELS: Record<RegistrationType, string> = {
  GST: "GST",
  PT: "Professional Tax",
  IEC: "Import Export Code",
  MSME_UDYAM: "MSME / Udyam",
  FSSAI: "FSSAI",
  SHOPS_ESTAB: "Shops & Establishment",
  PF: "Provident Fund",
  ESIC: "ESIC",
  DIN: "DIN",
  LLPIN: "LLPIN",
  CIN: "CIN",
  TAN: "TAN",
  OTHER: "Other",
}

export const REGISTRATION_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "SURRENDERED",
  "CANCELLED",
] as const

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  SURRENDERED: "Surrendered",
  CANCELLED: "Cancelled",
}

export const DSC_CLASSES = ["CLASS_2", "CLASS_3"] as const

export type DscClass = (typeof DSC_CLASSES)[number]

export const DSC_CLASS_LABELS: Record<DscClass, string> = {
  CLASS_2: "Class 2",
  CLASS_3: "Class 3",
}

export const DSC_STATUSES = ["ACTIVE", "EXPIRED", "REVOKED"] as const

export type DscStatus = (typeof DSC_STATUSES)[number]

export const DSC_STATUS_LABELS: Record<DscStatus, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
}

/** Loose UDIN shape: 15–18 alphanumeric characters. */
export const UDIN_PATTERN = /^[A-Za-z0-9]{15,18}$/
