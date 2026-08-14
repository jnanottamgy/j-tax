"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requirePartner, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { toUserError } from "@/lib/forms/errors"
import {
  acceptanceVerdict,
  findConflicts,
  type Conflict,
} from "@/lib/clients/conflict-check"

/**
 * Two things a practice is required to do and had nowhere to record.
 *
 *  - Client acceptance. Nothing stood between "Add client" and a live
 *    engagement, so a prospect who is the same entity under a second name, or
 *    the opposing party in a matter the firm already acts on, was created
 *    without comment.
 *
 *  - Peer review. A practice unit is reviewed on a cycle and needs a valid
 *    certificate to sign certain attest work. The date lived in a partner's
 *    memory until the certificate lapsed.
 */

// ─── Client acceptance ───────────────────────────────────────────────────────

export type ConflictCheckResult = {
  conflicts: Conflict[]
  clear: boolean
  needsRationale: boolean
  summary: string
}

/**
 * Run the check without recording anything.
 *
 * Called as the onboarding form is filled in, so the answer arrives before the
 * client exists rather than after.
 */
export async function checkProspect(input: {
  prospectName: string
  pan?: string | null
  gstin?: string | null
  relatedParties?: string[]
}): Promise<ConflictCheckResult> {
  await requirePartnerOrManager()

  if (!input.prospectName?.trim()) {
    return { conflicts: [], clear: true, needsRationale: false, summary: "No name to check." }
  }

  const existing = await prisma.client.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      pan: true,
      gstin: true,
      group: { select: { name: true } },
    },
    take: 2000,
  })

  const conflicts = findConflicts({
    prospectName: input.prospectName,
    pan: input.pan,
    gstin: input.gstin,
    relatedParties: input.relatedParties,
    existing: existing.map((c) => ({
      clientId: c.id,
      name: c.name,
      pan: c.pan,
      gstin: c.gstin,
      groupName: c.group?.name ?? null,
    })),
  })

  return { conflicts, ...acceptanceVerdict(conflicts) }
}

const acceptanceSchema = z.object({
  prospectName: z.string().trim().min(1, "Who is the prospect?"),
  pan: z.string().trim().optional(),
  gstin: z.string().trim().optional(),
  relatedParties: z.array(z.string().trim()).default([]),
  outcome: z.enum(["ACCEPTED", "DECLINED"]),
  rationale: z.string().trim().optional(),
  clientId: z.string().optional(),
})

/**
 * Record the decision.
 *
 * A rationale is required whenever the check found something — "we looked and
 * took them on anyway, for this reason" is a perfectly good answer, and the
 * only one a reviewer can assess. Accepting a clean prospect needs no essay.
 */
export async function recordAcceptanceDecision(
  input: unknown
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to accept clients." }
  }

  const parsed = acceptanceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  const check = await checkProspect({
    prospectName: data.prospectName,
    pan: data.pan,
    gstin: data.gstin,
    relatedParties: data.relatedParties,
  })

  if (check.conflicts.length > 0 && !data.rationale) {
    return {
      success: false,
      fieldErrors: {
        rationale: ["The check found something. Say why this decision was made."],
      },
    }
  }

  try {
    await prisma.clientAcceptance.create({
      data: {
        prospectName: data.prospectName,
        pan: data.pan || null,
        gstin: data.gstin || null,
        relatedParties: data.relatedParties,
        // Frozen at decision time: the book changes, and what matters later is
        // what was in front of whoever decided.
        conflictsFound: check.conflicts as unknown as object,
        outcome: data.outcome,
        rationale: data.rationale || null,
        decidedBy: session.user.id,
        decidedAt: new Date(),
        clientId: data.clientId || null,
        createdBy: session.user.id,
      },
    })

    revalidatePath("/clients")
    return { success: true }
  } catch (error) {
    console.error("Failed to record acceptance decision:", error)
    return { success: false, error: toUserError(error) }
  }
}

export type AcceptanceRow = {
  id: string
  prospectName: string
  outcome: string
  rationale: string | null
  conflictCount: number
  decidedAt: string | null
  clientId: string | null
}

export async function getAcceptanceRegister(): Promise<AcceptanceRow[]> {
  await requirePartnerOrManager()
  const rows = await prisma.clientAcceptance.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  return rows.map((r) => ({
    id: r.id,
    prospectName: r.prospectName,
    outcome: r.outcome,
    rationale: r.rationale,
    conflictCount: Array.isArray(r.conflictsFound) ? r.conflictsFound.length : 0,
    decidedAt: r.decidedAt?.toISOString() ?? null,
    clientId: r.clientId,
  }))
}

// ─── Peer review ─────────────────────────────────────────────────────────────

const peerReviewSchema = z.object({
  periodFrom: z.string().min(1, "When does the review period start?"),
  periodTo: z.string().min(1, "When does it end?"),
  reviewerName: z.string().trim().min(1, "Who is the reviewer?"),
  reviewerFrn: z.string().trim().optional(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED"]).default("SCHEDULED"),
  reviewedOn: z.string().optional(),
  certificateNo: z.string().trim().optional(),
  validUntil: z.string().optional(),
  observations: z.string().trim().optional(),
})

export type PeerReviewRow = {
  id: string
  periodFrom: string
  periodTo: string
  reviewerName: string
  status: string
  reviewedOn: string | null
  certificateNo: string | null
  validUntil: string | null
  observations: string | null
  /** Days until the certificate lapses. Negative once it has. */
  daysToExpiry: number | null
}

export async function getPeerReviews(): Promise<PeerReviewRow[]> {
  await requirePartnerOrManager()
  const rows = await prisma.peerReview.findMany({ orderBy: { periodTo: "desc" }, take: 50 })
  const now = Date.now()

  return rows.map((r) => ({
    id: r.id,
    periodFrom: r.periodFrom.toISOString(),
    periodTo: r.periodTo.toISOString(),
    reviewerName: r.reviewerName,
    status: r.status,
    reviewedOn: r.reviewedOn?.toISOString() ?? null,
    certificateNo: r.certificateNo,
    validUntil: r.validUntil?.toISOString() ?? null,
    observations: r.observations,
    daysToExpiry: r.validUntil
      ? Math.ceil((r.validUntil.getTime() - now) / 86_400_000)
      : null,
  }))
}

export async function savePeerReview(
  input: unknown,
  reviewId?: string
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
  let session
  try {
    // The firm's own review record is a partner matter.
    session = await requirePartner()
  } catch {
    return { success: false, error: "Only a Partner can record peer reviews." }
  }

  const parsed = peerReviewSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const d = parsed.data

  const toDate = (v?: string) => (v ? new Date(v) : null)
  const periodFrom = new Date(d.periodFrom)
  const periodTo = new Date(d.periodTo)
  if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) {
    return { success: false, error: "Those dates are not valid." }
  }
  if (periodTo < periodFrom) {
    return { success: false, fieldErrors: { periodTo: ["The period cannot end before it starts."] } }
  }

  try {
    const payload = {
      periodFrom,
      periodTo,
      reviewerName: d.reviewerName,
      reviewerFrn: d.reviewerFrn || null,
      status: d.status,
      reviewedOn: toDate(d.reviewedOn),
      certificateNo: d.certificateNo || null,
      validUntil: toDate(d.validUntil),
      observations: d.observations || null,
    }

    if (reviewId) {
      const updated = await prisma.peerReview.updateMany({ where: { id: reviewId }, data: payload })
      if (updated.count === 0) return { success: false, error: "That review no longer exists." }
    } else {
      await prisma.peerReview.create({ data: { ...payload, createdBy: session.user.id } })
    }

    revalidatePath("/registers")
    return { success: true }
  } catch (error) {
    console.error("Failed to save peer review:", error)
    return { success: false, error: toUserError(error) }
  }
}

// ─── File retention ──────────────────────────────────────────────────────────

export type RetentionSummary = {
  /** Documents whose retention period has run out — safe to destroy. */
  expired: number
  /** Documents due to expire within a year. */
  expiringSoon: number
  /** Documents with no retention date set at all. */
  unset: number
  total: number
}

/**
 * What must still be kept, and what has been held past the point of usefulness.
 *
 * SQC 1 expects working papers retained for at least seven years from the date
 * of the report. Both halves matter to a reviewer: a firm that destroys early
 * cannot evidence its work, and one that keeps everything for ever is holding
 * client financial data it has no reason to hold.
 */
export async function getRetentionSummary(): Promise<RetentionSummary> {
  await requirePartnerOrManager()

  const now = new Date()
  const inAYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

  const [expired, expiringSoon, unset, total] = await Promise.all([
    prisma.document.count({ where: { deletedAt: null, retentionUntil: { lt: now } } }),
    prisma.document.count({
      where: { deletedAt: null, retentionUntil: { gte: now, lte: inAYear } },
    }),
    prisma.document.count({ where: { deletedAt: null, retentionUntil: null } }),
    prisma.document.count({ where: { deletedAt: null } }),
  ])

  return { expired, expiringSoon, unset, total }
}

/**
 * Set a retention date on documents that have none.
 *
 * Seven years from the document's own creation, which is the closest thing the
 * vault holds to a report date. Deliberately only fills blanks — a date somebody
 * set deliberately must not be overwritten by a bulk default.
 */
export async function backfillRetentionDates(): Promise<{ updated: number }> {
  await requirePartner()

  const docs = await prisma.document.findMany({
    where: { deletedAt: null, retentionUntil: null },
    select: { id: true, createdAt: true },
    take: 5000,
  })

  let updated = 0
  for (const doc of docs) {
    const until = new Date(doc.createdAt)
    until.setFullYear(until.getFullYear() + 7)
    await prisma.document.update({ where: { id: doc.id }, data: { retentionUntil: until } })
    updated++
  }

  revalidatePath("/registers")
  return { updated }
}
