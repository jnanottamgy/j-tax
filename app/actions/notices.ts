"use server"

/**
 * Tax notice & litigation register — CRUD + status ladder.
 * Reply-deadline reminders ride the existing daily cron (reminders route).
 */

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById, getClientScopeWhere } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { recordTimelineEvent } from "@/lib/timeline/events"
// NOTE: NOTICE_STATUSES lives in a separate no-directive module. A "use server"
// file may only EXPORT async functions, so we import it here for internal use
// (z.enum below) and consumers import it from "./notice-statuses" directly.
import { NOTICE_STATUSES } from "./notice-statuses"

const dateField = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined)
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date")

const noticeSchema = z.object({
  clientId: z.string().min(1, "Pick a client"),
  noticeType: z.string().min(2, "Notice type is required").max(120),
  section: z.string().max(60).optional().transform((v) => v?.trim() || undefined),
  authority: z.string().max(200).optional().transform((v) => v?.trim() || undefined),
  referenceNo: z.string().max(100).optional().transform((v) => v?.trim() || undefined),
  noticeDate: dateField,
  receivedDate: dateField,
  replyDueDate: dateField,
  hearingDate: dateField,
  status: z.enum(NOTICE_STATUSES).default("OPEN"),
  demandAmount: z
    .string()
    .optional()
    .transform((v) => v?.replace(/[₹,\s]/g, "") || undefined)
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Invalid amount"),
  description: z.string().max(2000).optional().transform((v) => v?.trim() || undefined),
  notes: z.string().max(5000).optional().transform((v) => v?.trim() || undefined),
  assignedEmployeeId: z.string().optional().transform((v) => v || undefined),
})

export type NoticeInput = z.input<typeof noticeSchema>

export type NoticeActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: string
}

function toData(parsed: z.output<typeof noticeSchema>) {
  return {
    clientId: parsed.clientId,
    noticeType: parsed.noticeType.trim(),
    section: parsed.section ?? null,
    authority: parsed.authority ?? null,
    referenceNo: parsed.referenceNo ?? null,
    noticeDate: parsed.noticeDate ? new Date(parsed.noticeDate) : null,
    receivedDate: parsed.receivedDate ? new Date(parsed.receivedDate) : null,
    replyDueDate: parsed.replyDueDate ? new Date(parsed.replyDueDate) : null,
    hearingDate: parsed.hearingDate ? new Date(parsed.hearingDate) : null,
    status: parsed.status,
    demandAmount: parsed.demandAmount ? Number(parsed.demandAmount) : null,
    description: parsed.description ?? null,
    notes: parsed.notes ?? null,
    assignedEmployeeId: parsed.assignedEmployeeId ?? null,
  }
}

export async function createNotice(input: NoticeInput): Promise<NoticeActionState> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch {
    return { error: "Not signed in." }
  }
  const userId = session.user.id

  const parsed = noticeSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // Employees may only record notices for their assigned clients.
  if (!(await canAccessClientById(session, parsed.data.clientId))) {
    return { error: "You can only record notices for your assigned clients." }
  }

  const row = await prisma.taxNotice.create({
    data: { ...toData(parsed.data), createdBy: userId },
  })

  await recordTimelineEvent({
    clientId: parsed.data.clientId,
    eventType: "NOTE_ADDED",
    title: `Tax notice recorded: ${parsed.data.noticeType}`,
    performedBy: userId,
  }).catch(() => null)

  revalidatePath("/notices")
  return { success: true, id: row.id }
}

export async function updateNotice(id: string, input: NoticeInput): Promise<NoticeActionState> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch {
    return { error: "Not signed in." }
  }

  const parsed = noticeSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const existing = await prisma.taxNotice.findUnique({ where: { id }, select: { id: true, clientId: true } })
  if (!existing) return { error: "Notice not found." }

  // Employees may only edit notices of their assigned clients — both the
  // notice's current client and the (possibly re-picked) target client.
  if (
    !(await canAccessClientById(session, existing.clientId)) ||
    !(await canAccessClientById(session, parsed.data.clientId))
  ) {
    return { error: "You can only edit notices for your assigned clients." }
  }

  await prisma.taxNotice.update({ where: { id }, data: toData(parsed.data) })
  revalidatePath("/notices")
  return { success: true, id }
}

export async function deleteNotice(id: string): Promise<NoticeActionState> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "Only partners/managers can delete notices." }
  }
  await prisma.taxNotice.delete({ where: { id } }).catch(() => null)
  revalidatePath("/notices")
  return { success: true }
}

export async function listNotices(filter?: { status?: string; clientId?: string }) {
  const session = await requireAuth()
  // Employees see only their assigned clients' notices.
  return prisma.taxNotice.findMany({
    where: {
      client: await getClientScopeWhere(session),
      ...(filter?.status
        ? filter.status === "OPEN_ALL"
          ? { status: { notIn: ["CLOSED_FAVOURABLE", "CLOSED_UNFAVOURABLE", "CLOSED_PARTIAL"] } }
          : { status: filter.status }
        : {}),
      ...(filter?.clientId ? { clientId: filter.clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      assignedEmployee: { select: { id: true, name: true } },
    },
    orderBy: [{ replyDueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
  })
}

export async function getNoticeFormOptions() {
  const session = await requireAuth()
  const [clients, employees] = await Promise.all([
    prisma.client.findMany({
      where: { ...(await getClientScopeWhere(session)), deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])
  return { clients, employees }
}
