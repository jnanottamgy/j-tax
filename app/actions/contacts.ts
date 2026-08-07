"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  requireAuth,
  requirePartnerOrManager,
} from "@/lib/auth/guards"
import { canAccessClientById, clientFirmFilter } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { ENTITY_TYPES, TEAM_ROLES } from "@/lib/clients/master-data"
import { toUserError } from "@/lib/forms/errors"

import type { TeamRole } from "@prisma/client"

// ─── Shared types ────────────────────────────────────────────────────────────

export type MasterDataActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export type ContactItem = {
  id: string
  clientId: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  notes: string | null
}

export type TeamMemberItem = {
  id: string
  clientId: string
  employeeId: string
  role: TeamRole
  employeeName: string
  employeeDepartment: string | null
}

export type GroupListItem = {
  id: string
  name: string
  notes: string | null
  clientCount: number
  /** ₹ outstanding across member clients (SENT / PARTIALLY_PAID / OVERDUE invoices). */
  outstandingTotal: number
}

export type GroupDetail = {
  id: string
  name: string
  notes: string | null
  clients: {
    id: string
    name: string
    code: string
    status: string
  }[]
  outstandingTotal: number
}

export type AssignableClient = {
  id: string
  name: string
  code: string
  groupId: string | null
  groupName: string | null
}

export type ClientMasterData = {
  entityType: string | null
  stateCode: string | null
  groupId: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Duck-typed check for Prisma's unique-constraint violation (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

function revalidateClient(clientId: string) {
  revalidatePath("/clients")
  revalidatePath(`/clients/${clientId}`)
}

/** Invoice statuses that still carry an outstanding balance. */
const OPEN_INVOICE_STATUSES = ["SENT", "PARTIALLY_PAID", "OVERDUE"] as const

// ─── Contacts ────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
  email: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null)
    .refine(
      (v) => !v || z.string().email().safeParse(v).success,
      "Enter a valid email"
    ),
  phone: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null)
    .refine((v) => !v || /^[+]?[\d\s\-().]{7,20}$/.test(v), "Enter a valid phone number"),
  notes: z
    .string()
    .max(1000, "Notes are too long")
    .optional()
    .nullable()
    .transform((v) => v?.trim() || null),
  isPrimary: z.boolean().optional(),
})

export type ContactInput = z.input<typeof contactSchema>

export async function listContacts(clientId: string): Promise<ContactItem[]> {
  const session = await requireAuth()
  // Employees may only read contacts of their assigned clients.
  if (!(await canAccessClientById(session, clientId))) return []
  const contacts = await prisma.clientContact.findMany({
    where: { clientId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  })
  return contacts.map((c) => ({
    id: c.id,
    clientId: c.clientId,
    name: c.name,
    role: c.role,
    email: c.email,
    phone: c.phone,
    isPrimary: c.isPrimary,
    notes: c.notes,
  }))
}

export async function createContact(
  clientId: string,
  input: ContactInput
): Promise<MasterDataActionState> {
  try {
    await requirePartnerOrManager()

    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const { isPrimary, ...fields } = parsed.data

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientId, isPrimary: true },
          data: { isPrimary: false },
        })
      }
      await tx.clientContact.create({
        data: {
          clientId,
          name: fields.name,
          role: fields.role || null,
          email: fields.email || null,
          phone: fields.phone || null,
          notes: fields.notes || null,
          isPrimary: isPrimary ?? false,
        },
      })
    })

    revalidateClient(clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function updateContact(
  contactId: string,
  input: ContactInput
): Promise<MasterDataActionState> {
  try {
    const session = await requirePartnerOrManager()

    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const existing = await prisma.clientContact.findFirst({
      where: { id: contactId, ...clientFirmFilter(session) },
      select: { clientId: true },
    })
    if (!existing) return { error: "Contact not found." }

    const { isPrimary, ...fields } = parsed.data

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientId: existing.clientId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        })
      }
      await tx.clientContact.update({
        where: { id: contactId },
        data: {
          name: fields.name,
          role: fields.role || null,
          email: fields.email || null,
          phone: fields.phone || null,
          notes: fields.notes || null,
          ...(isPrimary !== undefined ? { isPrimary } : {}),
        },
      })
    })

    revalidateClient(existing.clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function deleteContact(
  contactId: string
): Promise<MasterDataActionState> {
  try {
    const session = await requirePartnerOrManager()

    const existing = await prisma.clientContact.findFirst({
      where: { id: contactId, ...clientFirmFilter(session) },
      select: { clientId: true },
    })
    if (!existing) return { error: "Contact not found." }

    await prisma.clientContact.delete({ where: { id: contactId } })

    revalidateClient(existing.clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

/** Marks one contact primary and clears the flag on the client's others. */
export async function setPrimaryContact(
  contactId: string
): Promise<MasterDataActionState> {
  try {
    const session = await requirePartnerOrManager()

    const contact = await prisma.clientContact.findFirst({
      where: { id: contactId, ...clientFirmFilter(session) },
      select: { clientId: true },
    })
    if (!contact) return { error: "Contact not found." }

    await prisma.$transaction([
      prisma.clientContact.updateMany({
        where: { clientId: contact.clientId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      }),
      prisma.clientContact.update({
        where: { id: contactId },
        data: { isPrimary: true },
      }),
    ])

    revalidateClient(contact.clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

// ─── Groups ──────────────────────────────────────────────────────────────────

const groupNameSchema = z.string().trim().min(1, "Group name is required").max(120)

export async function listGroups(): Promise<GroupListItem[]> {
  await requirePartnerOrManager() // full-roster view — management only

  const groups = await prisma.clientGroup.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      notes: true,
      clients: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  })

  const memberIds = groups.flatMap((g) => g.clients.map((c) => c.id))

  // One grouped aggregate for every member, then bucket per group in JS —
  // avoids an N+1 aggregate per group card.
  const sums =
    memberIds.length > 0
      ? await prisma.invoice.groupBy({
          by: ["clientId"],
          where: {
            clientId: { in: memberIds },
            deletedAt: null,
            status: { in: [...OPEN_INVOICE_STATUSES] },
          },
          _sum: { outstandingAmount: true },
        })
      : []

  const outstandingByClient = new Map(
    sums.map((s) => [s.clientId, Number(s._sum.outstandingAmount ?? 0)])
  )

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    notes: g.notes,
    clientCount: g.clients.length,
    outstandingTotal: g.clients.reduce(
      (sum, c) => sum + (outstandingByClient.get(c.id) ?? 0),
      0
    ),
  }))
}

/** Groups list plus the viewer's manage flag — for the /groups page. */
export async function getGroupsData(): Promise<{
  groups: GroupListItem[]
  canManage: boolean
}> {
  const session = await requirePartnerOrManager() // full-roster view — management only
  const groups = await listGroups()
  return {
    groups,
    canManage:
      session.user.role === "PARTNER" || session.user.role === "MANAGER",
  }
}

export async function createGroup(
  name: string,
  notes?: string
): Promise<MasterDataActionState & { groupId?: string }> {
  try {
    await requirePartnerOrManager()

    const parsedName = groupNameSchema.safeParse(name)
    if (!parsedName.success) {
      return { error: parsedName.error.issues[0]?.message ?? "Invalid group name" }
    }

    const group = await prisma.clientGroup.create({
      data: {
        name: parsedName.data,
        notes: notes?.trim() || null,
      },
    })

    revalidatePath("/groups")
    revalidatePath("/clients")
    return { success: true, groupId: group.id }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "A group with that name already exists." }
    }
    return { error: toUserError(error) }
  }
}

export async function renameGroup(
  groupId: string,
  name: string,
  notes?: string
): Promise<MasterDataActionState> {
  try {
    await requirePartnerOrManager()

    const parsedName = groupNameSchema.safeParse(name)
    if (!parsedName.success) {
      return { error: parsedName.error.issues[0]?.message ?? "Invalid group name" }
    }

    await prisma.clientGroup.update({
      where: { id: groupId },
      data: {
        name: parsedName.data,
        ...(notes !== undefined ? { notes: notes.trim() || null } : {}),
      },
    })

    revalidatePath("/groups")
    revalidatePath("/clients")
    return { success: true }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "A group with that name already exists." }
    }
    return { error: toUserError(error) }
  }
}

/**
 * Deletes a group. Member clients keep all their data — the Client.group
 * relation is onDelete: SetNull, so they simply leave the group.
 */
export async function deleteGroup(
  groupId: string
): Promise<MasterDataActionState> {
  try {
    await requirePartnerOrManager()

    await prisma.clientGroup.delete({ where: { id: groupId } })

    revalidatePath("/groups")
    revalidatePath("/clients")
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function assignClientToGroup(
  clientId: string,
  groupId: string | null
): Promise<MasterDataActionState> {
  try {
    await requirePartnerOrManager()

    await prisma.client.update({
      where: { id: clientId },
      data: { groupId },
    })

    revalidatePath("/groups")
    revalidateClient(clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail> {
  await requirePartnerOrManager() // full-roster view — management only

  const group = await prisma.clientGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      notes: true,
      clients: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, clientCode: true, status: true },
      },
    },
  })
  if (!group) {
    throw new Error("Group not found")
  }

  const memberIds = group.clients.map((c) => c.id)
  const aggregate =
    memberIds.length > 0
      ? await prisma.invoice.aggregate({
          where: {
            clientId: { in: memberIds },
            deletedAt: null,
            status: { in: [...OPEN_INVOICE_STATUSES] },
          },
          _sum: { outstandingAmount: true },
        })
      : null

  return {
    id: group.id,
    name: group.name,
    notes: group.notes,
    clients: group.clients.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.clientCode,
      status: c.status,
    })),
    outstandingTotal: Number(aggregate?._sum.outstandingAmount ?? 0),
  }
}

/** Active clients for the "Assign clients" dialog (id, name, code, current group). */
export async function listAssignableClients(): Promise<AssignableClient[]> {
  await requirePartnerOrManager() // full-roster view — management only

  const clients = await prisma.client.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      clientCode: true,
      groupId: true,
      group: { select: { name: true } },
    },
  })

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.clientCode,
    groupId: c.groupId,
    groupName: c.group?.name ?? null,
  }))
}

// ─── Engagement team ─────────────────────────────────────────────────────────

export async function listTeam(clientId: string): Promise<TeamMemberItem[]> {
  const session = await requireAuth()
  if (!(await canAccessClientById(session, clientId))) return []

  const members = await prisma.clientTeamMember.findMany({
    where: { clientId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: {
      employee: { select: { name: true, department: true } },
    },
  })

  return members.map((m) => ({
    id: m.id,
    clientId: m.clientId,
    employeeId: m.employeeId,
    role: m.role,
    employeeName: m.employee.name,
    employeeDepartment: m.employee.department,
  }))
}

export async function addTeamMember(
  clientId: string,
  employeeId: string,
  role: TeamRole
): Promise<MasterDataActionState> {
  try {
    const session = await requirePartnerOrManager()

    if (!TEAM_ROLES.includes(role)) {
      return { error: "Invalid team role." }
    }
    if (!employeeId) {
      return { error: "Select an employee." }
    }

    // Both ids arrive from the request. ClientTeamMember has no firmId of its
    // own, so validate each side against this firm before joining them —
    // otherwise a team row could straddle two tenants.
    if (!(await canAccessClientById(session, clientId))) {
      return { error: "Client not found." }
    }
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    })
    if (!employee) return { error: "Employee not found." }

    await prisma.clientTeamMember.create({
      data: { clientId, employeeId, role },
    })

    revalidateClient(clientId)
    return { success: true }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error: "That employee is already on the team in this role.",
      }
    }
    return { error: toUserError(error) }
  }
}

export async function removeTeamMember(
  id: string
): Promise<MasterDataActionState> {
  try {
    const session = await requirePartnerOrManager()

    const existing = await prisma.clientTeamMember.findFirst({
      where: { id, ...clientFirmFilter(session) },
      select: { clientId: true },
    })
    if (!existing) return { error: "Team member not found." }

    await prisma.clientTeamMember.delete({ where: { id } })

    revalidateClient(existing.clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

/** Active employees for the add-member select. */
export async function getEmployeeOptions(): Promise<
  { id: string; name: string; department: string | null }[]
> {
  await requireAuth()

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, department: true },
  })
  return employees
}

// ─── Client master data (entity type / state / group) ───────────────────────

const masterDataSchema = z.object({
  entityType: z.enum(ENTITY_TYPES).nullable().optional(),
  stateCode: z.string().trim().max(60).nullable().optional(),
  groupId: z.string().trim().min(1).nullable().optional(),
})

export type MasterDataInput = z.input<typeof masterDataSchema>

/** Current entityType / stateCode / groupId — for pre-filling the edit dialog. */
export async function getClientMasterData(
  clientId: string
): Promise<ClientMasterData> {
  const session = await requireAuth()
  // Employees may only read master data of their assigned clients.
  if (!(await canAccessClientById(session, clientId))) {
    throw new Error("Forbidden: not your assigned client")
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { entityType: true, stateCode: true, groupId: true },
  })
  if (!client) {
    throw new Error("Client not found")
  }
  return client
}

/**
 * Dedicated master-data update (entity type, state code, group) — kept out of
 * the shared updateClient action on purpose. Only touches fields that were
 * actually provided.
 */
export async function updateClientMasterData(
  clientId: string,
  input: MasterDataInput
): Promise<MasterDataActionState> {
  try {
    await requirePartnerOrManager()

    const parsed = masterDataSchema.safeParse(input)
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors }
    }

    const data: Record<string, string | null> = {}
    if ("entityType" in input) data.entityType = parsed.data.entityType ?? null
    if ("stateCode" in input) data.stateCode = parsed.data.stateCode || null
    if ("groupId" in input) data.groupId = parsed.data.groupId ?? null

    if (Object.keys(data).length === 0) {
      return { success: true }
    }

    await prisma.client.update({
      where: { id: clientId },
      data,
    })

    revalidateClient(clientId)
    revalidatePath("/groups")
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}
