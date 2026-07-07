"use server"

/**
 * Recycle bin — lists soft-deleted clients, documents, and invoices, and can
 * restore them or purge them permanently. Partner/Manager only.
 *
 * Soft-deleted rows are hidden everywhere else by the central filter in
 * lib/prisma.ts; the reads here opt out by passing `deletedAt: { not: null }`.
 */

import { revalidatePath } from "next/cache"
import { requirePartner, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { toUserError } from "@/lib/forms/errors"
import { deleteFile } from "@/lib/storage/storage"

export type TrashActionState = { success?: boolean; error?: string }

export type TrashData = {
  clients: Array<{ id: string; name: string; clientCode: string; deletedAt: Date }>
  documents: Array<{ id: string; title: string; fileName: string; clientName: string; deletedAt: Date }>
  invoices: Array<{ id: string; invoiceNumber: string; amount: number; clientName: string; deletedAt: Date }>
}

const notDeleted = { deletedAt: { not: null } } as const

export async function getTrashData(): Promise<TrashData> {
  await requirePartnerOrManager()

  const [clients, documents, invoices] = await Promise.all([
    prisma.client.findMany({
      where: notDeleted,
      select: { id: true, name: true, clientCode: true, deletedAt: true },
      orderBy: { deletedAt: "desc" },
      take: 500,
    }),
    prisma.document.findMany({
      where: notDeleted,
      select: { id: true, title: true, fileName: true, deletedAt: true, client: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
      take: 500,
    }),
    prisma.invoice.findMany({
      where: notDeleted,
      select: { id: true, invoiceNumber: true, amount: true, deletedAt: true, client: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
      take: 500,
    }),
  ])

  return {
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      clientCode: c.clientCode,
      deletedAt: c.deletedAt as Date,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      fileName: d.fileName,
      clientName: d.client?.name ?? "—",
      deletedAt: d.deletedAt as Date,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      amount: Number(i.amount),
      clientName: i.client?.name ?? "—",
      deletedAt: i.deletedAt as Date,
    })),
  }
}

export type TrashItemType = "client" | "document" | "invoice"

export async function restoreItem(type: TrashItemType, id: string): Promise<TrashActionState> {
  try {
    await requirePartnerOrManager()
    if (type === "client") {
      await prisma.client.update({ where: { id }, data: { deletedAt: null } })
      revalidatePath("/clients")
    } else if (type === "document") {
      await prisma.document.update({ where: { id }, data: { deletedAt: null } })
      revalidatePath("/documents")
    } else {
      await prisma.invoice.update({ where: { id }, data: { deletedAt: null } })
      revalidatePath("/payments/invoices")
      revalidatePath("/payments")
    }
    revalidatePath("/trash")
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function purgeItem(type: TrashItemType, id: string): Promise<TrashActionState> {
  try {
    // Restore is Partner/Manager, but PERMANENT destruction of firm records
    // (a client with all its tasks/invoices/documents) is a Partner decision.
    await requirePartner()

    if (type === "client") {
      // Guard: only a soft-deleted client can be purged.
      const client = await prisma.client.findUnique({ where: { id }, select: { deletedAt: true } })
      if (!client?.deletedAt) return { error: "Only items in the recycle bin can be permanently deleted." }
      await prisma.client.delete({ where: { id } })
      revalidatePath("/clients")
    } else if (type === "document") {
      const doc = await prisma.document.findUnique({
        where: { id },
        select: { deletedAt: true, storagePath: true },
      })
      if (!doc?.deletedAt) return { error: "Only items in the recycle bin can be permanently deleted." }
      // Now remove the underlying Storage file (kept until this point so a
      // restore could recover it).
      if (doc.storagePath) {
        const res = await deleteFile(doc.storagePath)
        if (res.error) console.error("Storage purge failed:", res.error)
      }
      await prisma.document.delete({ where: { id } })
      revalidatePath("/documents")
    } else {
      const invoice = await prisma.invoice.findUnique({ where: { id }, select: { deletedAt: true } })
      if (!invoice?.deletedAt) return { error: "Only items in the recycle bin can be permanently deleted." }
      await prisma.invoice.delete({ where: { id } })
      revalidatePath("/payments/invoices")
    }
    revalidatePath("/trash")
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}
