"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { recordTimelineEvent } from "@/lib/timeline/events"
import { parseFinancialYear } from "@/lib/india/format"

/**
 * Proof that a filing happened, captured against the work that produced it.
 *
 * FilingRecord has carried `taskId`, `acknowledgementNo` and `documentId` since
 * it was added, and nothing ever wrote them together. A filing could only be
 * recorded from the client's history tab — a separate screen, opened later, by
 * someone retyping an ARN out of a portal or an email. So the acknowledgement
 * number, which is the firm's only evidence that a return went in, was captured
 * late or not at all, and never joined to the task it belonged to.
 *
 * This runs at the one moment the ARN is actually on screen: when the person
 * who filed marks the task done. The task supplies the client, the service and
 * the period, so what is left to type is the number itself.
 *
 * UDIN comes with it. The register held a number, a client and a free-text
 * document type, and nothing pointing at the work — a list of numbers that
 * could not answer which signed document each belonged to, which is the only
 * question anyone asks of it.
 */

const captureSchema = z.object({
  taskId: z.string().min(1),
  /** "GSTR-3B", "ITR-6", "Tax Audit Report" — free text, the list is long. */
  filingType: z.string().trim().min(1, "Say what was filed."),
  /**
   * The year the return relates to, as "2025-26".
   *
   * Deliberately not derived from the filing date: an ITR for 2025-26 is filed
   * in July 2026, and a belated one a year after that. Guessing it from
   * `filedOn` would file a third of the register under the wrong year, quietly,
   * and nobody would notice until a notice arrived.
   */
  financialYear: z.string().trim().min(4, "Which year does this return relate to?"),
  /** "Apr 2026", "Q2", "Annual". */
  period: z.string().trim().optional(),
  filedOn: z.string().min(1, "When was it filed?"),
  acknowledgementNo: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  /**
   * UDIN, when the deliverable was signed. Fifteen digits + two check chars in
   * practice, but ICAI has changed the format before, so this only checks that
   * it looks like a UDIN rather than asserting a fixed shape.
   */
  udin: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{15,20}$/, "A UDIN is 15–20 letters and digits.")
    .optional()
    .or(z.literal("")),
  /** What was signed, when a UDIN is being recorded. */
  udinDocumentType: z.string().trim().optional(),
})

export type FilingCaptureInput = z.input<typeof captureSchema>

export type TaskFilingSummary = {
  filingRecordId: string
  filingType: string
  period: string | null
  filedOn: string | null
  acknowledgementNo: string | null
  udins: Array<{ id: string; udin: string; documentType: string }>
}

/** What has already been captured against this task, for the task drawer. */
export async function getTaskFiling(taskId: string): Promise<TaskFilingSummary | null> {
  const session = await requireAuth()

  const record = await prisma.filingRecord.findFirst({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clientId: true,
      filingType: true,
      period: true,
      filedOn: true,
      acknowledgementNo: true,
      udinRecords: { select: { id: true, udin: true, documentType: true } },
    },
  })
  if (!record) return null
  if (!(await canAccessClientById(session, record.clientId))) return null

  return {
    filingRecordId: record.id,
    filingType: record.filingType,
    period: record.period,
    filedOn: record.filedOn?.toISOString() ?? null,
    acknowledgementNo: record.acknowledgementNo,
    udins: record.udinRecords,
  }
}

export async function captureTaskFiling(
  input: FilingCaptureInput
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string[]> }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You do not have permission to record filings." }
  }

  const parsed = captureSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors }
  }
  const data = parsed.data

  const task = await prisma.task.findUnique({
    where: { id: data.taskId },
    select: { id: true, title: true, clientId: true, serviceType: true },
  })
  if (!task?.clientId) {
    return { success: false, error: "That task is not attached to a client." }
  }
  if (!(await canAccessClientById(session, task.clientId))) {
    return { success: false, error: "Task not found." }
  }

  const filedOn = new Date(data.filedOn)
  if (Number.isNaN(filedOn.getTime())) {
    return { success: false, fieldErrors: { filedOn: ["That is not a valid date."] } }
  }

  // Normalised so the register does not end up holding "2025-26", "FY 2025-26"
  // and "2025" as three different years.
  const fy = parseFinancialYear(data.financialYear)
  if (!fy) {
    return {
      success: false,
      fieldErrors: { financialYear: ["Use a year like 2025-26."] },
    }
  }

  const udin = data.udin?.trim()
  if (udin && !data.udinDocumentType?.trim()) {
    return {
      success: false,
      fieldErrors: {
        udinDocumentType: ["Say what document this UDIN was generated for."],
      },
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // One filing per task. Re-recording corrects the number rather than
      // adding a second row — a duplicate ARN against one return is worse than
      // no ARN, because it makes the register ambiguous.
      const existing = await tx.filingRecord.findFirst({
        where: { taskId: task.id },
        select: { id: true },
      })

      const payload = {
        clientId: task.clientId!,
        financialYear: fy.short,
        filingType: data.filingType.trim(),
        serviceType: task.serviceType,
        period: data.period?.trim() || null,
        filedOn,
        acknowledgementNo: data.acknowledgementNo?.trim() || null,
        taskId: task.id,
        notes: data.notes?.trim() || null,
      }

      const record = existing
        ? await tx.filingRecord.update({ where: { id: existing.id }, data: payload })
        : await tx.filingRecord.create({
            data: { ...payload, createdBy: session.user.id },
          })

      if (udin) {
        // The register is unique per firm on the number itself, so re-saving
        // the same UDIN updates its link instead of failing the whole capture.
        await tx.udinRecord.upsert({
          where: { firmId_udin: { firmId: record.firmId, udin } },
          update: {
            filingRecordId: record.id,
            clientId: task.clientId,
            documentType: data.udinDocumentType!.trim(),
            documentDate: filedOn,
          },
          create: {
            udin,
            clientId: task.clientId,
            filingRecordId: record.id,
            documentType: data.udinDocumentType!.trim(),
            documentDate: filedOn,
            generatedBy: session.user.name,
          },
        })
      }
    })

    await recordTimelineEvent({
      clientId: task.clientId,
      eventType: "COMPLIANCE_FILED",
      title: `${data.filingType.trim()} filed`,
      description: data.acknowledgementNo
        ? `Acknowledgement ${data.acknowledgementNo.trim()}`
        : `Recorded against "${task.title}"`,
      performedBy: session.user.id,
    }).catch(() => { /* the record itself is what matters */ })

    revalidatePath("/work-tracker")
    revalidatePath(`/clients/${task.clientId}`)
    revalidatePath("/registers")
    return { success: true }
  } catch (error) {
    console.error("Failed to capture filing:", error)
    return { success: false, error: "Could not save the filing. Please try again." }
  }
}
