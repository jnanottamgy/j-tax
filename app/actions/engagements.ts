"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById } from "@/lib/auth/scope"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { recordTimelineEvent } from "@/lib/timeline/events"
import { parseFinancialYear } from "@/lib/india/format"

/**
 * Engagement letters and filing history.
 *
 * Two records a practice is expected to keep and the app had nowhere to put:
 *
 *  - The engagement letter. SA 210 expects terms agreed in writing before work
 *    starts, and a peer review asks to see them. Without a record of one, the
 *    document defining the firm's obligations lived in somebody's email.
 *
 *  - What has already been filed. A client arriving from another CA brings a
 *    year of history the app could not hold, so the firm had no idea what was
 *    already done. The same record holds our own acknowledgement numbers.
 */

const SERVICE_TYPES = [
  "GST_RETURN", "INCOME_TAX", "TDS", "PAYROLL",
  "BOOKKEEPING", "AUDIT", "COMPANY_LAW", "INCORPORATION", "OTHER",
] as const

/** "2025-26" — the form the whole app already uses for a financial year. */
const financialYear = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Use the form "2025-26"')

const engagementSchema = z.object({
  clientId: z.string().min(1),
  financialYear,
  serviceTypes: z.array(z.enum(SERVICE_TYPES)).default([]),
  scope: z.string().max(4000).optional(),
  feeAgreed: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return undefined
      const n = Number(v)
      return Number.isFinite(n) && n >= 0 ? n : undefined
    }),
  status: z.enum(["DRAFT", "ISSUED", "SIGNED", "DECLINED", "EXPIRED"]).default("DRAFT"),
  issuedAt: z.string().optional(),
  signedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

function toDate(v?: string): Date | null {
  if (!v?.trim()) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export type EngagementLetterRow = {
  id: string
  financialYear: string
  serviceTypes: string[]
  scope: string | null
  feeAgreed: number | null
  status: string
  issuedAt: string | null
  signedAt: string | null
  expiresAt: string | null
  notes: string | null
  /** Days until it lapses; negative once expired. Null when no expiry is set. */
  daysToExpiry: number | null
}

export async function getEngagementLetters(
  clientId: string
): Promise<EngagementLetterRow[]> {
  const session = await getSession()
  if (!session) return []
  if (!(await canAccessClientById(session, clientId))) return []

  const rows = await prisma.engagementLetter.findMany({
    where: { clientId },
    orderBy: [{ financialYear: "desc" }, { createdAt: "desc" }],
  })

  const now = Date.now()
  return rows.map((r) => ({
    id: r.id,
    financialYear: r.financialYear,
    serviceTypes: r.serviceTypes,
    scope: r.scope,
    feeAgreed: r.feeAgreed != null ? Number(r.feeAgreed) : null,
    status: r.status,
    issuedAt: r.issuedAt?.toISOString() ?? null,
    signedAt: r.signedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    notes: r.notes,
    daysToExpiry: r.expiresAt
      ? Math.ceil((r.expiresAt.getTime() - now) / 86_400_000)
      : null,
  }))
}

export async function saveEngagementLetter(
  input: unknown,
  letterId?: string
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to record engagement terms." }
  }

  const parsed = engagementSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  if (!(await canAccessClientById(session, data.clientId))) {
    return { success: false, error: "Client not found." }
  }

  const signedAt = toDate(data.signedAt)
  // Recording a signature is what makes the letter effective, so the status
  // follows the date rather than relying on the user to set both consistently.
  const status = signedAt && data.status === "ISSUED" ? "SIGNED" : data.status

  const payload = {
    clientId: data.clientId,
    financialYear: data.financialYear,
    serviceTypes: data.serviceTypes as never,
    scope: data.scope?.trim() || null,
    feeAgreed: data.feeAgreed ?? null,
    status: status as never,
    issuedAt: toDate(data.issuedAt),
    signedAt,
    expiresAt: toDate(data.expiresAt),
    notes: data.notes?.trim() || null,
  }

  try {
    if (letterId) {
      // updateMany, not update: it is firm-scoped by the tenant extension, so a
      // letter id from another firm matches nothing instead of being written.
      const result = await prisma.engagementLetter.updateMany({
        where: { id: letterId },
        data: payload,
      })
      if (result.count === 0) return { success: false, error: "Engagement letter not found." }
    } else {
      await prisma.engagementLetter.create({
        data: { ...payload, createdBy: session.user.id },
      })
      await recordTimelineEvent({
        clientId: data.clientId,
        eventType: "NOTE_ADDED",
        title: `Engagement letter recorded — ${data.financialYear}`,
        description: signedAt
          ? `Signed ${signedAt.toLocaleDateString("en-IN")}`
          : `Status: ${status.toLowerCase()}`,
        performedBy: session.user.id,
      }).catch(() => { /* the letter is recorded either way */ })
    }

    revalidatePath(`/clients/${data.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to save engagement letter:", error)
    return { success: false, error: "Could not save the engagement letter. Please try again." }
  }
}

export async function deleteEngagementLetter(
  letterId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, error: "Permission denied." }
  }
  const result = await prisma.engagementLetter.deleteMany({ where: { id: letterId } })
  if (result.count === 0) return { success: false, error: "Engagement letter not found." }
  return { success: true }
}

// ─── Filing history ──────────────────────────────────────────────────────────

const filingSchema = z.object({
  clientId: z.string().min(1),
  financialYear,
  filingType: z.string().min(1, "What was filed?").max(60),
  serviceType: z.enum(SERVICE_TYPES).optional().or(z.literal("").transform(() => undefined)),
  period: z.string().max(40).optional(),
  filedOn: z.string().optional(),
  acknowledgementNo: z.string().max(60).optional(),
  filedByExternal: z.string().max(200).optional(),
  taskId: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export type FilingRecordRow = {
  id: string
  financialYear: string
  filingType: string
  serviceType: string | null
  period: string | null
  filedOn: string | null
  acknowledgementNo: string | null
  filedByExternal: string | null
  taskId: string | null
  notes: string | null
}

export async function getFilingRecords(clientId: string): Promise<FilingRecordRow[]> {
  const session = await getSession()
  if (!session) return []
  if (!(await canAccessClientById(session, clientId))) return []

  const rows = await prisma.filingRecord.findMany({
    where: { clientId },
    orderBy: [{ financialYear: "desc" }, { filedOn: "desc" }, { createdAt: "desc" }],
    take: 400,
  })

  return rows.map((r) => ({
    id: r.id,
    financialYear: r.financialYear,
    filingType: r.filingType,
    serviceType: r.serviceType,
    period: r.period,
    filedOn: r.filedOn?.toISOString() ?? null,
    acknowledgementNo: r.acknowledgementNo,
    filedByExternal: r.filedByExternal,
    taskId: r.taskId,
    notes: r.notes,
  }))
}

export async function saveFilingRecord(
  input: unknown,
  recordId?: string
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to record filings." }
  }

  const parsed = filingSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  if (!(await canAccessClientById(session, data.clientId))) {
    return { success: false, error: "Client not found." }
  }

  const payload = {
    clientId: data.clientId,
    financialYear: data.financialYear,
    filingType: data.filingType.trim(),
    serviceType: (data.serviceType ?? null) as never,
    period: data.period?.trim() || null,
    filedOn: toDate(data.filedOn),
    acknowledgementNo: data.acknowledgementNo?.trim() || null,
    filedByExternal: data.filedByExternal?.trim() || null,
    taskId: data.taskId?.trim() || null,
    notes: data.notes?.trim() || null,
  }

  try {
    if (recordId) {
      const result = await prisma.filingRecord.updateMany({
        where: { id: recordId },
        data: payload,
      })
      if (result.count === 0) return { success: false, error: "Filing not found." }
    } else {
      await prisma.filingRecord.create({
        data: { ...payload, createdBy: session.user.id },
      })
    }

    revalidatePath(`/clients/${data.clientId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to save filing record:", error)
    return { success: false, error: "Could not save the filing. Please try again." }
  }
}

export async function deleteFilingRecord(
  recordId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, error: "Permission denied." }
  }
  const result = await prisma.filingRecord.deleteMany({ where: { id: recordId } })
  if (result.count === 0) return { success: false, error: "Filing not found." }
  return { success: true }
}

/**
 * Bulk-record what a predecessor already filed.
 *
 * The realistic onboarding path: a client moves across mid-year and the firm
 * needs last year's returns on file before it can safely start this year's.
 */
export async function importPriorFilings(input: {
  clientId: string
  filedByExternal: string
  financialYear: string
  filings: Array<{ filingType: string; period?: string; filedOn?: string; acknowledgementNo?: string }>
}): Promise<{ success: boolean; created: number; error?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, created: 0, error: "Permission denied." }
  }

  if (!(await canAccessClientById(session, input.clientId))) {
    return { success: false, created: 0, error: "Client not found." }
  }

  const rows = input.filings
    .filter((f) => f.filingType?.trim())
    .slice(0, 200)
    .map((f) => ({
      clientId: input.clientId,
      financialYear: input.financialYear,
      filingType: f.filingType.trim(),
      period: f.period?.trim() || null,
      filedOn: toDate(f.filedOn),
      acknowledgementNo: f.acknowledgementNo?.trim() || null,
      filedByExternal: input.filedByExternal.trim() || "Previous accountant",
      createdBy: session.user.id,
    }))

  if (rows.length === 0) return { success: true, created: 0 }

  try {
    await prisma.filingRecord.createMany({ data: rows })
    revalidatePath(`/clients/${input.clientId}`)
    return { success: true, created: rows.length }
  } catch (error) {
    console.error("Failed to import prior filings:", error)
    return { success: false, created: 0, error: "Could not import those filings." }
  }
}

/** Engagement letters lapsing soon or already lapsed, across the firm. */
export async function getExpiringEngagements(withinDays = 45) {
  await requirePartnerOrManager()

  const cutoff = new Date(Date.now() + withinDays * 86_400_000)
  const rows = await prisma.engagementLetter.findMany({
    where: {
      status: { in: ["ISSUED", "SIGNED"] },
      expiresAt: { not: null, lte: cutoff },
    },
    select: {
      id: true,
      financialYear: true,
      expiresAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: { expiresAt: "asc" },
    take: 50,
  })

  return rows.map((r) => ({
    id: r.id,
    clientId: r.client.id,
    clientName: r.client.name,
    financialYear: r.financialYear,
    expiresAt: r.expiresAt!.toISOString(),
    daysToExpiry: Math.ceil((r.expiresAt!.getTime() - Date.now()) / 86_400_000),
  }))
}

/** Clients with active services and no engagement letter for the given year. */
export async function getClientsMissingEngagementLetter(financialYearLabel: string) {
  await requirePartnerOrManager()

  const clients = await prisma.client.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      services: { some: { isActive: true } },
      engagementLetters: { none: { financialYear: financialYearLabel } },
    },
    select: { id: true, name: true, clientCode: true },
    orderBy: { name: "asc" },
    take: 200,
  })

  return clients
}

/**
 * Open next year's engagement letter from this year's.
 *
 * SA 210 expects terms agreed before work starts, and in practice a firm agrees
 * them once and rolls them forward. The app could record a letter and tell you
 * when it expired, and then left you to retype the whole thing — so the renewal
 * that should take a minute took long enough to postpone, and the engagement
 * ran on lapsed terms.
 *
 * The copy is a DRAFT: rolling terms forward is a decision, and a letter that
 * issued itself would be terms the client never agreed to.
 */
export async function renewEngagementLetter(
  letterId: string
): Promise<{ success: boolean; error?: string; letterId?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to renew engagement letters." }
  }

  const original = await prisma.engagementLetter.findUnique({ where: { id: letterId } })
  if (!original) return { success: false, error: "Engagement letter not found." }
  if (!(await canAccessClientById(session, original.clientId))) {
    return { success: false, error: "Engagement letter not found." }
  }

  const parsedFy = parseFinancialYear(original.financialYear)
  if (!parsedFy) {
    return { success: false, error: `Cannot work out the year after "${original.financialYear}".` }
  }
  const nextStart = parsedFy.startYear + 1
  const nextFy = `${nextStart}-${String((nextStart + 1) % 100).padStart(2, "0")}`

  const existing = await prisma.engagementLetter.findFirst({
    where: { clientId: original.clientId, financialYear: nextFy },
    select: { id: true },
  })
  if (existing) {
    return { success: false, error: `A letter for ${nextFy} already exists.` }
  }

  try {
    const copy = await prisma.engagementLetter.create({
      data: {
        clientId: original.clientId,
        financialYear: nextFy,
        serviceTypes: original.serviceTypes,
        scope: original.scope,
        feeAgreed: original.feeAgreed,
        status: "DRAFT",
        // The new terms run to the end of the year they cover — 31 March.
        expiresAt: new Date(nextStart + 1, 2, 31, 23, 59, 59, 999),
        notes: original.notes,
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/clients/${original.clientId}`)
    return { success: true, letterId: copy.id }
  } catch (error) {
    console.error("Failed to renew engagement letter:", error)
    return { success: false, error: "Could not create the renewal. Please try again." }
  }
}
