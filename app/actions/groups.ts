"use server"

/**
 * Client groups — bundle related clients (group companies, families, a shared
 * promoter) so a firm can view and act on them together. Reads are staff-wide;
 * mutations are Partner/Manager only. Deleting a group only un-links its
 * clients (Client.groupId is SetNull) — no client is ever removed.
 */

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { toUserError } from "@/lib/forms/errors"

export type GroupActionState = {
  success?: boolean
  error?: string
  id?: string
}

export type GroupRow = {
  id: string
  name: string
  notes: string | null
  clientCount: number
  clients: Array<{ id: string; name: string; clientCode: string }>
}

const groupSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters").max(120),
  notes: z.string().trim().max(2000).optional().transform((v) => v || undefined),
})

export async function listGroups(): Promise<GroupRow[]> {
  // Full-roster view — management only (employees see only assigned clients).
  await requirePartnerOrManager()
  const groups = await prisma.clientGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      clients: {
        where: { deletedAt: null },
        select: { id: true, name: true, clientCode: true },
        orderBy: { name: "asc" },
      },
    },
  })
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    notes: g.notes,
    clientCount: g.clients.length,
    clients: g.clients,
  }))
}

/** Active clients + their current group, for the assignment picker. */
export async function getGroupAssignableClients(): Promise<
  Array<{ id: string; name: string; clientCode: string; groupId: string | null; groupName: string | null }>
> {
  await requirePartnerOrManager()
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      clientCode: true,
      groupId: true,
      group: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  })
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    clientCode: c.clientCode,
    groupId: c.groupId,
    groupName: c.group?.name ?? null,
  }))
}

export async function createGroup(input: { name: string; notes?: string }): Promise<GroupActionState> {
  try {
    await requirePartnerOrManager()
    const parsed = groupSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.flatten().fieldErrors.name?.[0] ?? "Invalid group details." }
    }
    // Name is unique per firm now — findFirst is auto-scoped to the tenant.
    const existing = await prisma.clientGroup.findFirst({ where: { name: parsed.data.name } })
    if (existing) return { error: "A group with this name already exists." }

    const group = await prisma.clientGroup.create({
      data: { name: parsed.data.name, notes: parsed.data.notes ?? null },
    })
    revalidatePath("/groups")
    return { success: true, id: group.id }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function renameGroup(id: string, input: { name: string; notes?: string }): Promise<GroupActionState> {
  try {
    await requirePartnerOrManager()
    const parsed = groupSchema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.flatten().fieldErrors.name?.[0] ?? "Invalid group details." }
    }
    const clash = await prisma.clientGroup.findFirst({
      where: { name: parsed.data.name, NOT: { id } },
      select: { id: true },
    })
    if (clash) return { error: "Another group already uses this name." }

    await prisma.clientGroup.update({
      where: { id },
      data: { name: parsed.data.name, notes: parsed.data.notes ?? null },
    })
    revalidatePath("/groups")
    return { success: true, id }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function deleteGroup(id: string): Promise<GroupActionState> {
  try {
    await requirePartnerOrManager()
    // Client.groupId is SetNull — clients survive, they're just ungrouped.
    await prisma.clientGroup.delete({ where: { id } })
    revalidatePath("/groups")
    revalidatePath("/clients")
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

/** Set (or clear, with groupId=null) the group for a set of clients. */
export async function setClientsGroup(
  groupId: string | null,
  clientIds: string[]
): Promise<GroupActionState> {
  try {
    await requirePartnerOrManager()
    if (clientIds.length === 0) return { error: "Select at least one client." }

    if (groupId) {
      const group = await prisma.clientGroup.findUnique({ where: { id: groupId }, select: { id: true } })
      if (!group) return { error: "Group not found." }
    }

    await prisma.client.updateMany({
      where: { id: { in: clientIds }, deletedAt: null },
      data: { groupId },
    })
    revalidatePath("/groups")
    revalidatePath("/clients")
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}
