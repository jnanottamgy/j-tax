/**
 * Client master-data constants: entity types (constitution), contact roles,
 * and engagement-team roles. Shared by the contacts/team tab, the edit-client
 * dialog, the groups page, and app/actions/contacts.ts.
 *
 * Note: Client.entityType is a plain String? in Prisma — the canonical value
 * list lives here, not in the schema.
 */

export const ENTITY_TYPES = [
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PVT_LTD",
  "PUBLIC_LTD",
  "SECTION_8",
  "TRUST",
  "AOP",
  "OTHER",
  // Retained for backward compatibility with existing client records.
  "HUF",
  "INDIVIDUAL",
] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  PROPRIETORSHIP: "Sole Proprietorship",
  PARTNERSHIP: "Partnership Firm",
  LLP: "LLP",
  PVT_LTD: "Private Limited Company",
  PUBLIC_LTD: "Public Company",
  SECTION_8: "Section 8 Company",
  TRUST: "Trust",
  AOP: "AOP",
  OTHER: "Others",
  HUF: "HUF",
  INDIVIDUAL: "Individual",
}

/**
 * The ordered Client Type options shown in the add/edit-client dropdown.
 * "OTHER" reveals a free-text field (stored in Client.entityTypeCustom).
 */
export const CLIENT_TYPE_OPTIONS = [
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PVT_LTD",
  "PUBLIC_LTD",
  "SECTION_8",
  "TRUST",
  "AOP",
  "OTHER",
] as const satisfies readonly EntityType[]

export const CONTACT_ROLES = [
  "Director",
  "CFO",
  "Authorized Signatory",
  "Accountant",
  "Promoter",
  "Other",
] as const

export type ContactRole = (typeof CONTACT_ROLES)[number]

export const TEAM_ROLES = [
  "ENGAGEMENT_PARTNER",
  "REVIEW_MANAGER",
  "PREPARER",
] as const

export type TeamRoleValue = (typeof TEAM_ROLES)[number]

export const TEAM_ROLE_LABELS: Record<TeamRoleValue, string> = {
  ENGAGEMENT_PARTNER: "Engagement Partner",
  REVIEW_MANAGER: "Review Manager",
  PREPARER: "Preparer",
}

/** Badge tints: Engagement Partner amber, Review Manager blue, Preparer gray. */
export const TEAM_ROLE_BADGE_CLASSES: Record<TeamRoleValue, string> = {
  ENGAGEMENT_PARTNER: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  REVIEW_MANAGER: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PREPARER: "bg-slate-500/10 text-slate-400 border-slate-500/20",
}
