"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { toUserError } from "@/lib/forms/errors"
import { prisma } from "@/lib/prisma"

/**
 * Job templates — reusable checklists for recurring CA engagements.
 *
 * A template describes the steps of a job (e.g. "Monthly GST Filing") with
 * per-step offsets (days BEFORE the job due date the step should be done).
 * Applying a template to a client creates ONE Task plus its checklist items.
 *
 * Template CRUD is PARTNER/MANAGER only (mirrors task creation in
 * app/actions/tasks.ts). Checklist interaction lives in app/actions/checklists.ts.
 */

// ─── Types shared with the UI ────────────────────────────────────────────────

export type JobTemplateItemRow = {
  id: string
  title: string
  description: string | null
  sortOrder: number
  offsetDays: number
}

export type JobTemplateListItem = {
  id: string
  name: string
  serviceType: ServiceTypeValue
  description: string | null
  isActive: boolean
  itemCount: number
  items: JobTemplateItemRow[]
}

export type ClientOption = { id: string; name: string; clientCode: string }
export type EmployeeOption = { id: string; name: string }

export type JobTemplateActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

// ─── Validation ──────────────────────────────────────────────────────────────

const SERVICE_TYPES = [
  "GST_RETURN",
  "INCOME_TAX",
  "TDS",
  "PAYROLL",
  "BOOKKEEPING",
  "AUDIT",
  "COMPANY_LAW",
  "OTHER",
] as const

type ServiceTypeValue = (typeof SERVICE_TYPES)[number]

const templateItemSchema = z.object({
  title: z.string().trim().min(1, "Step title is required").max(200),
  description: z.string().trim().max(1000).optional(),
  /** Days BEFORE the job due date — negative offsets are clamped to 0. */
  offsetDays: z.coerce.number().int().min(0, "Offset must be 0 or more").max(365),
})

const templateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(120),
  serviceType: z.enum(SERVICE_TYPES),
  description: z.string().trim().max(1000).optional(),
  items: z.array(templateItemSchema).min(1, "Add at least one checklist step"),
})

const applyJobSchema = z.object({
  templateId: z.string().min(1, "Template is required"),
  clientId: z.string().min(1, "Client is required"),
  dueDate: z.string().min(1, "Due date is required"),
  assignedEmployeeId: z.string().optional(),
})

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listJobTemplates(): Promise<JobTemplateListItem[]> {
  await requirePartnerOrManager()

  const templates = await prisma.jobTemplate.findMany({
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  })

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    serviceType: t.serviceType as ServiceTypeValue,
    description: t.description,
    isActive: t.isActive,
    itemCount: t._count.items,
    items: t.items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      sortOrder: i.sortOrder,
      offsetDays: i.offsetDays,
    })),
  }))
}

/** Minimal option list for the "Start job" dialog client select. */
export async function getActiveClientOptions(): Promise<ClientOption[]> {
  await requirePartnerOrManager()

  return prisma.client.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, clientCode: true },
    orderBy: { name: "asc" },
  })
}

/** Minimal option list for the "Start job" dialog assignee select. */
export async function getActiveEmployeeOptions(): Promise<EmployeeOption[]> {
  await requirePartnerOrManager()

  return prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

// ─── Template CRUD ───────────────────────────────────────────────────────────

export async function createJobTemplate(input: {
  name: string
  serviceType: string
  description?: string
  items: Array<{ title: string; description?: string; offsetDays: number }>
}): Promise<JobTemplateActionState> {
  try {
    await requirePartnerOrManager()

    const parsed = templateSchema.safeParse(input)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const { name, serviceType, description, items } = parsed.data

    await prisma.jobTemplate.create({
      data: {
        name,
        serviceType,
        description: description?.trim() ? description : null,
        items: {
          create: items.map((item, index) => ({
            title: item.title,
            description: item.description?.trim() ? item.description : null,
            sortOrder: index,
            offsetDays: Math.max(0, item.offsetDays),
          })),
        },
      },
    })

    revalidatePath("/templates")

    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: "You do not have permission to manage job templates." }
    }
    return { error: toUserError(error) }
  }
}

export async function updateJobTemplate(input: {
  id: string
  name: string
  serviceType: string
  description?: string
  items: Array<{ title: string; description?: string; offsetDays: number }>
}): Promise<JobTemplateActionState> {
  try {
    await requirePartnerOrManager()

    if (!input.id) return { error: "Missing template id" }

    const parsed = templateSchema.safeParse(input)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const existing = await prisma.jobTemplate.findUnique({
      where: { id: input.id },
      select: { id: true },
    })
    if (!existing) return { error: "Template not found." }

    const { name, serviceType, description, items } = parsed.data

    // Replace items transactionally so a failed write never leaves a template
    // half-edited (old rows gone, new rows missing).
    await prisma.$transaction([
      prisma.jobTemplate.update({
        where: { id: input.id },
        data: {
          name,
          serviceType,
          description: description?.trim() ? description : null,
        },
      }),
      prisma.jobTemplateItem.deleteMany({ where: { templateId: input.id } }),
      prisma.jobTemplateItem.createMany({
        data: items.map((item, index) => ({
          templateId: input.id,
          title: item.title,
          description: item.description?.trim() ? item.description : null,
          sortOrder: index,
          offsetDays: Math.max(0, item.offsetDays),
        })),
      }),
    ])

    revalidatePath("/templates")

    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: "You do not have permission to manage job templates." }
    }
    return { error: toUserError(error) }
  }
}

export async function setTemplateActive(
  templateId: string,
  isActive: boolean
): Promise<JobTemplateActionState> {
  try {
    await requirePartnerOrManager()

    await prisma.jobTemplate.update({
      where: { id: templateId },
      data: { isActive },
    })

    revalidatePath("/templates")

    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: "You do not have permission to manage job templates." }
    }
    return { error: toUserError(error) }
  }
}

export async function deleteJobTemplate(
  templateId: string
): Promise<JobTemplateActionState> {
  try {
    await requirePartnerOrManager()

    const template = await prisma.jobTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    })
    if (!template) return { error: "Template not found." }

    // Items cascade with the template. Tasks already started from it keep
    // their own checklist copies.
    await prisma.jobTemplate.delete({ where: { id: templateId } })

    revalidatePath("/templates")

    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: "You do not have permission to manage job templates." }
    }
    return { error: toUserError(error) }
  }
}

// ─── Seed defaults ───────────────────────────────────────────────────────────

type TemplateSeed = {
  name: string
  serviceType: ServiceTypeValue
  description: string
  items: Array<{ title: string; offsetDays: number }>
}

const DEFAULT_JOB_TEMPLATES: TemplateSeed[] = [
  {
    name: "Monthly GST Filing",
    serviceType: "GST_RETURN",
    description: "Standard monthly GSTR-1 preparation and filing workflow.",
    items: [
      { title: "Collect sales register", offsetDays: 9 },
      { title: "Collect purchase register", offsetDays: 9 },
      { title: "GSTR-2B reconciliation", offsetDays: 6 },
      { title: "Prepare GSTR-1", offsetDays: 4 },
      { title: "File GSTR-1 & record ARN", offsetDays: 0 },
    ],
  },
  {
    name: "Quarterly TDS Return",
    serviceType: "TDS",
    description: "Quarterly TDS return preparation, filing and Form 16A issue.",
    items: [
      { title: "Reconcile challans", offsetDays: 10 },
      { title: "Compile deductee data", offsetDays: 7 },
      { title: "Validate FVU", offsetDays: 3 },
      { title: "File return", offsetDays: 0 },
      // Happens AFTER filing — negative offsets are clamped to 0.
      { title: "Download conso & issue Form 16A", offsetDays: -7 },
    ],
  },
  {
    name: "Income Tax Return (Non-Audit)",
    serviceType: "INCOME_TAX",
    description: "ITR preparation and e-filing for non-audit cases.",
    items: [
      { title: "Collect Form 16/16A", offsetDays: 30 },
      { title: "Download AIS/26AS", offsetDays: 25 },
      { title: "Compute income & regime comparison", offsetDays: 15 },
      { title: "Client approval", offsetDays: 7 },
      { title: "File & e-verify", offsetDays: 0 },
    ],
  },
  {
    name: "Statutory Audit",
    serviceType: "AUDIT",
    description: "End-to-end statutory audit engagement workflow.",
    items: [
      { title: "PBC list to client", offsetDays: 60 },
      { title: "Trial balance import", offsetDays: 45 },
      { title: "Fieldwork", offsetDays: 30 },
      { title: "Draft financials", offsetDays: 15 },
      { title: "Partner review & sign", offsetDays: 3 },
    ],
  },
  {
    name: "Monthly Bookkeeping",
    serviceType: "BOOKKEEPING",
    description: "Monthly books close for retainer clients.",
    items: [
      { title: "Bank statements", offsetDays: 7 },
      { title: "Enter purchases/sales", offsetDays: 5 },
      { title: "Reconcile bank", offsetDays: 2 },
      { title: "Close books", offsetDays: 0 },
    ],
  },
]

/** Seeds the 5 standard CA templates. No-op if any template already exists. */
export async function seedDefaultJobTemplates(): Promise<
  JobTemplateActionState & { created?: number }
> {
  try {
    await requirePartnerOrManager()

    const existing = await prisma.jobTemplate.count()
    if (existing > 0) {
      return { success: true, created: 0 }
    }

    for (const seed of DEFAULT_JOB_TEMPLATES) {
      await prisma.jobTemplate.create({
        data: {
          name: seed.name,
          serviceType: seed.serviceType,
          description: seed.description,
          items: {
            create: seed.items.map((item, index) => ({
              title: item.title,
              sortOrder: index,
              offsetDays: Math.max(0, item.offsetDays),
            })),
          },
        },
      })
    }

    revalidatePath("/templates")

    return { success: true, created: DEFAULT_JOB_TEMPLATES.length }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: "You do not have permission to manage job templates." }
    }
    return { error: toUserError(error) }
  }
}

// ─── Apply template → Task + checklist ───────────────────────────────────────

export async function applyJobTemplate(input: {
  templateId: string
  clientId: string
  dueDate: string
  assignedEmployeeId?: string
}): Promise<JobTemplateActionState & { taskId?: string; checklistCount?: number }> {
  try {
    await requirePartnerOrManager()

    const parsed = applyJobSchema.safeParse(input)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const dueDate = new Date(parsed.data.dueDate)
    if (Number.isNaN(dueDate.getTime())) {
      return { fieldErrors: { dueDate: ["Enter a valid due date"] } }
    }

    const template = await prisma.jobTemplate.findUnique({
      where: { id: parsed.data.templateId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    })
    if (!template) return { error: "Template not found." }
    if (!template.isActive) {
      return { error: "This template is inactive. Enable it before starting a job." }
    }

    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
      select: { id: true, name: true, deletedAt: true },
    })
    if (!client || client.deletedAt) return { error: "Client not found." }

    const assignedEmployeeId = parsed.data.assignedEmployeeId?.trim() || null
    if (assignedEmployeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: assignedEmployeeId },
        select: { id: true, isActive: true },
      })
      if (!employee?.isActive) return { error: "Assignee not found or inactive." }
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          clientId: client.id,
          title: `${template.name} — ${client.name}`,
          description: template.description,
          serviceType: template.serviceType,
          dueDate,
          assignedEmployeeId,
        },
      })

      if (template.items.length > 0) {
        await tx.taskChecklistItem.createMany({
          data: template.items.map((item, index) => ({
            taskId: created.id,
            title: item.title,
            sortOrder: index,
          })),
        })
      }

      return created
    })

    // In-app notification for the assignee (best-effort, mirrors tasks.ts)
    if (assignedEmployeeId) {
      try {
        const assignedEmployee = await prisma.employee.findUnique({
          where: { id: assignedEmployeeId },
          select: { userId: true },
        })
        if (assignedEmployee?.userId) {
          await prisma.notification.create({
            data: {
              userId: assignedEmployee.userId,
              title: "New Task Assigned",
              message: `You have been assigned: "${task.title}" (${template.items.length} checklist steps)`,
              type: "TASK_ASSIGNED",
              entityType: "TASK",
              entityId: task.id,
            },
          })
        }
      } catch (logErr) {
        console.error("activity/notification log failed:", logErr)
      }
    }

    revalidatePath("/work-tracker")
    revalidatePath(`/clients/${client.id}`)

    return {
      success: true,
      taskId: task.id,
      checklistCount: template.items.length,
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: "You do not have permission to start jobs from templates." }
    }
    return { error: toUserError(error) }
  }
}
