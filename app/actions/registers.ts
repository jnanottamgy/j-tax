"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { addDays } from "date-fns"

import { requirePartnerOrManager, requireStaff } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity/logger"
import { toUserError } from "@/lib/forms/errors"
import {
  DSC_CLASSES,
  DSC_STATUSES,
  REGISTRATION_STATUSES,
  REGISTRATION_TYPES,
  UDIN_PATTERN,
} from "@/lib/registers/constants"

/**
 * Statutory registers: registrations, DSCs, and UDINs.
 * Reads are staff-scoped (EMPLOYEES limited to their assigned clients);
 * all mutations are Partner/Manager only.
 */

export type RegisterActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export type RegistrationRow = {
  id: string
  clientId: string
  registrationType: string
  registrationNumber: string
  jurisdiction: string | null
  issueDate: Date | null
  expiryDate: Date | null
  reminderDays: number
  status: string
  notes: string | null
}

export type FirmRegistrationRow = RegistrationRow & { clientName: string }

export type DscRow = {
  id: string
  clientId: string
  holderName: string
  dscClass: string
  serialNumber: string | null
  issuedBy: string | null
  issueDate: Date | null
  expiryDate: Date
  custody: string | null
  status: string
  notes: string | null
}

export type FirmDscRow = DscRow & { clientName: string }

export type UdinRow = {
  id: string
  clientId: string | null
  udin: string
  documentType: string
  documentDate: Date
  generatedBy: string | null
  remarks: string | null
}

export type FirmUdinRow = UdinRow & { clientName: string | null }

export type RegisterSummary = {
  credentials: number
  registrations: number
  dscs: number
  udins: number
}

// ─── Validation ──────────────────────────────────────────────────────────────

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid date")

const requiredDate = z
  .string()
  .trim()
  .min(1, "Date is required")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date")

const registrationSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  id: z.string().optional(),
  registrationType: z.enum(REGISTRATION_TYPES),
  registrationNumber: z.string().trim().min(1, "Registration number is required").max(100),
  jurisdiction: z.string().trim().max(200).optional(),
  issueDate: optionalDate,
  expiryDate: optionalDate,
  reminderDays: z.coerce.number().int().min(0).max(365).default(30),
  status: z.enum(REGISTRATION_STATUSES).default("ACTIVE"),
  notes: z.string().trim().max(2000).optional(),
})

export type UpsertRegistrationInput = z.input<typeof registrationSchema>

const dscSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  id: z.string().optional(),
  holderName: z.string().trim().min(1, "Holder name is required").max(200),
  dscClass: z.enum(DSC_CLASSES).default("CLASS_3"),
  serialNumber: z.string().trim().max(100).optional(),
  issuedBy: z.string().trim().max(200).optional(),
  issueDate: optionalDate,
  expiryDate: requiredDate,
  custody: z.string().trim().max(200).optional(),
  status: z.enum(DSC_STATUSES).default("ACTIVE"),
  notes: z.string().trim().max(2000).optional(),
})

export type UpsertDscInput = z.input<typeof dscSchema>

const udinSchema = z.object({
  clientId: z.string().trim().optional(),
  udin: z
    .string()
    .trim()
    .regex(UDIN_PATTERN, "UDIN must be 15-18 letters/digits"),
  documentType: z.string().trim().min(1, "Document type is required").max(200),
  documentDate: requiredDate,
  generatedBy: z.string().trim().max(200).optional(),
  remarks: z.string().trim().max(2000).optional(),
})

export type CreateUdinInput = z.input<typeof udinSchema>

// EMPLOYEE reads are limited to their assigned clients (same convention as
// compliance actions); PARTNER/MANAGER read everything.
async function assertClientReadable(
  session: Awaited<ReturnType<typeof requireStaff>>,
  clientId: string
) {
  if (session.user.role !== "EMPLOYEE") return
  const [employee, client] = await Promise.all([
    prisma.employee.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
    prisma.client.findUnique({
      where: { id: clientId },
      select: { assignedEmployeeId: true },
    }),
  ])
  if (!client || !employee || client.assignedEmployeeId !== employee.id) {
    throw new Error("Forbidden: You can only view registers for your assigned clients")
  }
}

// ─── Client-scoped reads ─────────────────────────────────────────────────────

export async function listClientRegistrations(
  clientId: string
): Promise<{ registrations?: RegistrationRow[]; error?: string }> {
  try {
    const session = await requireStaff()
    await assertClientReadable(session, clientId)

    const registrations = await prisma.statutoryRegistration.findMany({
      where: { clientId },
      orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { registrationType: "asc" }],
    })
    return { registrations }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function listClientDscRecords(
  clientId: string
): Promise<{ dscs?: DscRow[]; error?: string }> {
  try {
    const session = await requireStaff()
    await assertClientReadable(session, clientId)

    const dscs = await prisma.dscRecord.findMany({
      where: { clientId },
      orderBy: [{ expiryDate: "asc" }, { holderName: "asc" }],
    })
    return { dscs }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function listClientUdinRecords(
  clientId: string
): Promise<{ udins?: UdinRow[]; error?: string }> {
  try {
    const session = await requireStaff()
    await assertClientReadable(session, clientId)

    const udins = await prisma.udinRecord.findMany({
      where: { clientId },
      orderBy: { documentDate: "desc" },
    })
    return { udins }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function getRegisterSummary(
  clientId: string
): Promise<{ summary?: RegisterSummary; error?: string }> {
  try {
    const session = await requireStaff()
    await assertClientReadable(session, clientId)

    const [credentials, registrations, dscs, udins] = await Promise.all([
      prisma.clientCredential.count({ where: { clientId } }),
      prisma.statutoryRegistration.count({ where: { clientId } }),
      prisma.dscRecord.count({ where: { clientId } }),
      prisma.udinRecord.count({ where: { clientId } }),
    ])
    return { summary: { credentials, registrations, dscs, udins } }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── Firm-wide reads (registers page — Partner/Manager) ─────────────────────

export async function listAllRegistrations(options?: {
  expiringWithinDays?: number
}): Promise<{ registrations?: FirmRegistrationRow[]; error?: string }> {
  try {
    await requirePartnerOrManager()

    const rows = await prisma.statutoryRegistration.findMany({
      where: {
        client: { deletedAt: null },
        ...(options?.expiringWithinDays !== undefined
          ? { expiryDate: { not: null, lte: addDays(new Date(), options.expiringWithinDays) } }
          : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { registrationType: "asc" }],
    })

    return {
      registrations: rows.map(({ client, ...row }) => ({
        ...row,
        clientName: client.name,
      })),
    }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function listAllDscRecords(options?: {
  expiringWithinDays?: number
}): Promise<{ dscs?: FirmDscRow[]; error?: string }> {
  try {
    await requirePartnerOrManager()

    const rows = await prisma.dscRecord.findMany({
      where: {
        client: { deletedAt: null },
        ...(options?.expiringWithinDays !== undefined
          ? { expiryDate: { lte: addDays(new Date(), options.expiringWithinDays) } }
          : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: [{ expiryDate: "asc" }, { holderName: "asc" }],
    })

    return {
      dscs: rows.map(({ client, ...row }) => ({ ...row, clientName: client.name })),
    }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function listAllUdinRecords(): Promise<{
  udins?: FirmUdinRow[]
  error?: string
}> {
  try {
    await requirePartnerOrManager()

    const rows = await prisma.udinRecord.findMany({
      where: { OR: [{ clientId: null }, { client: { deletedAt: null } }] },
      include: { client: { select: { name: true } } },
      orderBy: { documentDate: "desc" },
    })

    return {
      udins: rows.map(({ client, ...row }) => ({
        ...row,
        clientName: client?.name ?? null,
      })),
    }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── Statutory registration mutations ───────────────────────────────────────

export async function upsertRegistration(
  input: UpsertRegistrationInput
): Promise<RegisterActionState> {
  try {
    const session = await requirePartnerOrManager()

    const parsed = registrationSchema.safeParse(input)
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    const { clientId, id, ...data } = parsed.data
    const payload = {
      registrationType: data.registrationType,
      registrationNumber: data.registrationNumber,
      jurisdiction: data.jurisdiction || null,
      issueDate: data.issueDate ? new Date(data.issueDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      reminderDays: data.reminderDays,
      status: data.status,
      notes: data.notes || null,
    }

    if (id) {
      const existing = await prisma.statutoryRegistration.findUnique({
        where: { id },
        select: { clientId: true },
      })
      if (!existing || existing.clientId !== clientId) return { error: "Registration not found." }
      await prisma.statutoryRegistration.update({ where: { id }, data: payload })
    } else {
      await prisma.statutoryRegistration.create({ data: { clientId, ...payload } })
    }

    await logActivity({
      entityType: "REGISTER",
      entityId: id ?? clientId,
      action: id ? "UPDATED" : "CREATED",
      description: `${data.registrationType} registration ${data.registrationNumber} was ${id ? "updated" : "added"}`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId, registrationType: data.registrationType },
    })

    revalidatePath("/registers")
    revalidatePath(`/clients/${clientId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function deleteRegistration(id: string): Promise<RegisterActionState> {
  try {
    const session = await requirePartnerOrManager()

    const existing = await prisma.statutoryRegistration.findUnique({
      where: { id },
      select: { clientId: true, registrationType: true, registrationNumber: true },
    })
    if (!existing) return { error: "Registration not found." }

    await prisma.statutoryRegistration.delete({ where: { id } })

    await logActivity({
      entityType: "REGISTER",
      entityId: id,
      action: "DELETED",
      description: `${existing.registrationType} registration ${existing.registrationNumber} was deleted`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId: existing.clientId },
    })

    revalidatePath("/registers")
    revalidatePath(`/clients/${existing.clientId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── DSC mutations ───────────────────────────────────────────────────────────

export async function upsertDscRecord(input: UpsertDscInput): Promise<RegisterActionState> {
  try {
    const session = await requirePartnerOrManager()

    const parsed = dscSchema.safeParse(input)
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    const { clientId, id, ...data } = parsed.data
    const payload = {
      holderName: data.holderName,
      dscClass: data.dscClass,
      serialNumber: data.serialNumber || null,
      issuedBy: data.issuedBy || null,
      issueDate: data.issueDate ? new Date(data.issueDate) : null,
      expiryDate: new Date(data.expiryDate),
      custody: data.custody || null,
      status: data.status,
      notes: data.notes || null,
    }

    if (id) {
      const existing = await prisma.dscRecord.findUnique({
        where: { id },
        select: { clientId: true },
      })
      if (!existing || existing.clientId !== clientId) return { error: "DSC record not found." }
      await prisma.dscRecord.update({ where: { id }, data: payload })
    } else {
      await prisma.dscRecord.create({ data: { clientId, ...payload } })
    }

    await logActivity({
      entityType: "REGISTER",
      entityId: id ?? clientId,
      action: id ? "UPDATED" : "CREATED",
      description: `DSC for ${data.holderName} was ${id ? "updated" : "added"}`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId, holderName: data.holderName },
    })

    revalidatePath("/registers")
    revalidatePath(`/clients/${clientId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function deleteDscRecord(id: string): Promise<RegisterActionState> {
  try {
    const session = await requirePartnerOrManager()

    const existing = await prisma.dscRecord.findUnique({
      where: { id },
      select: { clientId: true, holderName: true },
    })
    if (!existing) return { error: "DSC record not found." }

    await prisma.dscRecord.delete({ where: { id } })

    await logActivity({
      entityType: "REGISTER",
      entityId: id,
      action: "DELETED",
      description: `DSC for ${existing.holderName} was deleted`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId: existing.clientId },
    })

    revalidatePath("/registers")
    revalidatePath(`/clients/${existing.clientId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── UDIN mutations ──────────────────────────────────────────────────────────

export async function createUdinRecord(input: CreateUdinInput): Promise<RegisterActionState> {
  try {
    const session = await requirePartnerOrManager()

    const parsed = udinSchema.safeParse(input)
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    const { clientId, udin, documentType, documentDate, generatedBy, remarks } = parsed.data

    await prisma.udinRecord.create({
      data: {
        clientId: clientId || null,
        udin: udin.toUpperCase(),
        documentType,
        documentDate: new Date(documentDate),
        generatedBy: generatedBy || null,
        remarks: remarks || null,
      },
    })

    await logActivity({
      entityType: "REGISTER",
      entityId: udin.toUpperCase(),
      action: "CREATED",
      description: `UDIN ${udin.toUpperCase()} (${documentType}) was recorded`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId: clientId || null },
    })

    revalidatePath("/registers")
    if (clientId) revalidatePath(`/clients/${clientId}`)
    return { success: true }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Unique constraint") || error.message.includes("unique constraint"))
    ) {
      return { fieldErrors: { udin: ["This UDIN is already recorded in the register."] } }
    }
    return { error: toUserError(error) }
  }
}

export async function deleteUdinRecord(id: string): Promise<RegisterActionState> {
  try {
    const session = await requirePartnerOrManager()

    const existing = await prisma.udinRecord.findUnique({
      where: { id },
      select: { clientId: true, udin: true },
    })
    if (!existing) return { error: "UDIN record not found." }

    await prisma.udinRecord.delete({ where: { id } })

    await logActivity({
      entityType: "REGISTER",
      entityId: id,
      action: "DELETED",
      description: `UDIN ${existing.udin} was removed from the register`,
      userId: session.user.id,
      userName: session.user.name,
      metadata: { clientId: existing.clientId },
    })

    revalidatePath("/registers")
    if (existing.clientId) revalidatePath(`/clients/${existing.clientId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── Expiring items (reminders cron) ─────────────────────────────────────────

export type ExpiringRegistration = {
  id: string
  clientId: string
  clientName: string
  registrationType: string
  registrationNumber: string
  expiryDate: Date
}

export type ExpiringDsc = {
  id: string
  clientId: string
  clientName: string
  holderName: string
  dscClass: string
  expiryDate: Date
}

/**
 * Registrations and DSCs whose expiry falls within the next `days` days
 * (already-lapsed ACTIVE items are included so reminders keep firing until
 * the register is updated).
 *
 * Intentionally session-free: the reminders cron (authenticated via
 * CRON_SECRET at the route level) calls this outside any user session.
 */
export async function getExpiringRegisterItems(days = 60): Promise<{
  registrations: ExpiringRegistration[]
  dscs: ExpiringDsc[]
}> {
  // The only action in the module that carried no guard. /registers is
  // Partner/Manager-only, but a server action is callable directly — so an
  // Employee could have read every client's statutory registration numbers and
  // DSC holders, and an unauthenticated call would have run with no firm scope
  // at all. Matched to the route.
  await requirePartnerOrManager()

  const cutoff = addDays(new Date(), days)

  const [registrationRows, dscRows] = await Promise.all([
    prisma.statutoryRegistration.findMany({
      where: {
        status: "ACTIVE",
        expiryDate: { not: null, lte: cutoff },
        client: { deletedAt: null },
      },
      select: {
        id: true,
        clientId: true,
        registrationType: true,
        registrationNumber: true,
        expiryDate: true,
        client: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.dscRecord.findMany({
      where: {
        status: "ACTIVE",
        expiryDate: { lte: cutoff },
        client: { deletedAt: null },
      },
      select: {
        id: true,
        clientId: true,
        holderName: true,
        dscClass: true,
        expiryDate: true,
        client: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    }),
  ])

  return {
    registrations: registrationRows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: r.client.name,
      registrationType: r.registrationType,
      registrationNumber: r.registrationNumber,
      // Filter guarantees non-null, but the schema allows null — assert once.
      expiryDate: r.expiryDate as Date,
    })),
    dscs: dscRows.map((d) => ({
      id: d.id,
      clientId: d.clientId,
      clientName: d.client.name,
      holderName: d.holderName,
      dscClass: d.dscClass,
      expiryDate: d.expiryDate,
    })),
  }
}
