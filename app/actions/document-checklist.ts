"use server"

/**
 * Client document checklist — mark which required documents have been
 * collected, add/remove items, and (for clients onboarded before this feature)
 * generate the list from their service mix.
 */

import { revalidatePath } from "next/cache"
import { requireStaff } from "@/lib/auth/guards"
import { canAccessClientById } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { toUserError } from "@/lib/forms/errors"
import { buildDocumentChecklist } from "@/lib/clients/onboarding"

export type ChecklistItemDTO = {
  id: string
  label: string
  collected: boolean
  collectedAt: Date | null
}

export type ChecklistActionState = { success?: boolean; error?: string; id?: string }

/** Fresh checklist for a client, ordered uncollected-first. */
export async function getClientChecklist(clientId: string): Promise<ChecklistItemDTO[]> {
  const session = await requireStaff()
  // Employees may only read checklists of their assigned clients.
  if (!(await canAccessClientById(session, clientId))) return []
  return prisma.clientDocumentChecklistItem.findMany({
    where: { clientId },
    select: { id: true, label: true, collected: true, collectedAt: true },
    orderBy: [{ collected: "asc" }, { createdAt: "asc" }],
  })
}

async function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`)
}

/** Toggle (or set) whether a checklist document has been collected. */
export async function setDocumentCollected(
  itemId: string,
  collected: boolean
): Promise<ChecklistActionState> {
  try {
    const session = await requireStaff()
    const item = await prisma.clientDocumentChecklistItem.findUnique({
      where: { id: itemId },
      select: { clientId: true },
    })
    if (!item) return { error: "Checklist item not found." }
    if (!(await canAccessClientById(session, item.clientId))) {
      return { error: "You can only manage checklists for your assigned clients." }
    }

    await prisma.clientDocumentChecklistItem.update({
      where: { id: itemId },
      data: { collected, collectedAt: collected ? new Date() : null },
    })
    await revalidateClient(item.clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function addChecklistItem(
  clientId: string,
  label: string
): Promise<ChecklistActionState> {
  try {
    const session = await requireStaff()
    if (!(await canAccessClientById(session, clientId))) {
      return { error: "You can only manage checklists for your assigned clients." }
    }
    const trimmed = label.trim()
    if (trimmed.length < 2) return { error: "Enter a document name." }
    if (trimmed.length > 200) return { error: "Document name is too long." }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    })
    if (!client) return { error: "Client not found." }

    // Avoid duplicates (case-insensitive) within the same client.
    const existing = await prisma.clientDocumentChecklistItem.findFirst({
      where: { clientId, label: { equals: trimmed, mode: "insensitive" } },
      select: { id: true },
    })
    if (existing) return { error: "That document is already on the checklist." }

    const created = await prisma.clientDocumentChecklistItem.create({
      data: { clientId, label: trimmed },
    })
    await revalidateClient(clientId)
    return { success: true, id: created.id }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function removeChecklistItem(itemId: string): Promise<ChecklistActionState> {
  try {
    const session = await requireStaff()
    const item = await prisma.clientDocumentChecklistItem.findUnique({
      where: { id: itemId },
      select: { clientId: true },
    })
    if (!item) return { error: "Checklist item not found." }
    if (!(await canAccessClientById(session, item.clientId))) {
      return { error: "You can only manage checklists for your assigned clients." }
    }

    await prisma.clientDocumentChecklistItem.delete({ where: { id: itemId } })
    await revalidateClient(item.clientId)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

/**
 * Build the checklist from the client's current services, adding any documents
 * not already present. Used for clients onboarded before checklists existed, or
 * after their service mix changes. Returns how many were added.
 */
export async function generateChecklistFromServices(
  clientId: string
): Promise<ChecklistActionState & { added?: number }> {
  try {
    const session = await requireStaff()
    if (!(await canAccessClientById(session, clientId))) {
      return { error: "You can only manage checklists for your assigned clients." }
    }
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        services: { where: { isActive: true }, select: { serviceType: true, frequency: true } },
        documentChecklist: { select: { label: true } },
      },
    })
    if (!client) return { error: "Client not found." }

    const labels = buildDocumentChecklist(
      client.services.map((s) => ({ serviceType: s.serviceType, frequency: s.frequency }))
    )
    const existing = new Set(client.documentChecklist.map((d) => d.label.toLowerCase()))
    const toAdd = labels.filter((l) => !existing.has(l.toLowerCase()))

    if (toAdd.length > 0) {
      await prisma.clientDocumentChecklistItem.createMany({
        data: toAdd.map((label) => ({ clientId, label })),
      })
      await revalidateClient(clientId)
    }
    return { success: true, added: toAdd.length }
  } catch (error) {
    return { error: toUserError(error) }
  }
}
