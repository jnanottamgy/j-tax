"use server"

/**
 * GSTR-2B reconciliation — server actions.
 *
 * The heavy lifting (parsing, matching) is pure code in lib/gst; these
 * actions add auth, persistence, and history. Runs are immutable snapshots —
 * re-running a period creates a new run rather than mutating the old one.
 */

import { revalidatePath } from "next/cache"
import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById, getClientScopeWhere } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { parseGstr2b } from "@/lib/gst/gstr2b"
import { reconcile, type RegisterDoc, type ReconSummary, type ReconEntry } from "@/lib/gst/reconcile"
import { validateGSTIN } from "@/lib/india/validators"

const MAX_DOCS = 20_000

/** Register rows as mapped in the browser (dates as ISO strings for the wire). */
export type WireRegisterRow = {
  supplierGstin: string
  supplierName?: string | null
  docType?: "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE"
  docNumber: string
  docDate: string | null
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  cess: number
}

export type RunReconResult =
  | {
      success: true
      runId: string
      summary: ReconSummary
      diagnostics: string[]
      docCounts: { books: number; portal: number }
    }
  | { success: false; error: string }

export async function runGstReconciliation(input: {
  clientId: string
  /** "MMYYYY" — defaults to the period inside the 2B file */
  period?: string
  gstr2bText: string
  registerRows: WireRegisterRow[]
}): Promise<RunReconResult> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch {
    return { success: false, error: "Not signed in." }
  }
  const userId = session.user.id

  // Employees may only reconcile their assigned clients.
  if (!(await canAccessClientById(session, input.clientId))) {
    return { success: false, error: "You can only run reconciliations for your assigned clients." }
  }

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true, name: true, gstin: true },
  })
  if (!client) return { success: false, error: "Client not found." }

  // Parse the portal file
  const parsed = parseGstr2b(input.gstr2bText)
  const diagnostics = [...parsed.diagnostics]
  if (parsed.docs.length === 0 && input.registerRows.length === 0) {
    return {
      success: false,
      error: diagnostics[0] ?? "Neither the 2B file nor the register contained any documents.",
    }
  }
  if (parsed.docs.length > MAX_DOCS || input.registerRows.length > MAX_DOCS) {
    return { success: false, error: `Too many documents (cap ${MAX_DOCS.toLocaleString()} per side).` }
  }

  // Cross-check the statement belongs to this client
  if (parsed.gstin && client.gstin && parsed.gstin !== client.gstin) {
    diagnostics.unshift(
      `⚠ The 2B file belongs to GSTIN ${parsed.gstin}, but ${client.name} is registered as ${client.gstin}. Results may be for the wrong client.`
    )
  }

  // Normalize register rows
  const books: RegisterDoc[] = []
  let invalidGstins = 0
  for (const r of input.registerRows) {
    const gstin = (r.supplierGstin ?? "").trim().toUpperCase()
    if (!validateGSTIN(gstin).valid) {
      invalidGstins++
      continue
    }
    const igst = Number(r.igst) || 0
    const cgst = Number(r.cgst) || 0
    const sgst = Number(r.sgst) || 0
    const cess = Number(r.cess) || 0
    books.push({
      supplierGstin: gstin,
      supplierName: r.supplierName?.trim() || null,
      docType: r.docType,
      docNumber: (r.docNumber ?? "").trim(),
      docDate: r.docDate ? new Date(r.docDate) : null,
      taxableValue: Number(r.taxableValue) || 0,
      igst,
      cgst,
      sgst,
      cess,
      totalTax: igst + cgst + sgst + cess,
    })
  }
  if (invalidGstins > 0) {
    diagnostics.push(`${invalidGstins} register row(s) skipped — supplier GSTIN failed checksum validation.`)
  }

  const { entries, summary } = reconcile(books, parsed.docs)

  const period = input.period?.trim() || parsed.period || "unknown"

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.gstReconRun.create({
      data: {
        clientId: client.id,
        period,
        portalGstin: parsed.gstin,
        summary: summary as object,
        diagnostics,
        createdBy: userId,
      },
    })
    // Dates inside entry JSON must be serializable
    await tx.gstReconEntry.createMany({
      data: entries.map((e) => ({
        runId: created.id,
        bucket: e.bucket,
        supplierGstin: e.supplierGstin,
        supplierName: e.supplierName,
        data: JSON.parse(JSON.stringify(e)) as object,
      })),
    })
    return created
  })

  revalidatePath("/gst-reconciliation")
  return {
    success: true,
    runId: run.id,
    summary,
    diagnostics,
    docCounts: { books: books.length, portal: parsed.docs.length },
  }
}

export async function listGstReconRuns() {
  const session = await requireAuth()
  // Employees see only their assigned clients' runs.
  return prisma.gstReconRun.findMany({
    where: { client: await getClientScopeWhere(session) },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { client: { select: { id: true, name: true } } },
  })
}

export async function getGstReconRun(runId: string): Promise<
  | { run: { id: string; period: string; createdAt: Date; clientName: string; summary: ReconSummary; diagnostics: string[] }; entries: ReconEntry[] }
  | null
> {
  const session = await requireAuth()
  const run = await prisma.gstReconRun.findUnique({
    where: { id: runId },
    include: {
      client: { select: { name: true } },
      entries: true,
    },
  })
  if (!run) return null
  // Employees may only open runs for their assigned clients.
  if (!(await canAccessClientById(session, run.clientId))) return null
  return {
    run: {
      id: run.id,
      period: run.period,
      createdAt: run.createdAt,
      clientName: run.client.name,
      summary: run.summary as unknown as ReconSummary,
      diagnostics: (run.diagnostics as unknown as string[]) ?? [],
    },
    entries: run.entries.map((e) => e.data as unknown as ReconEntry),
  }
}

export async function deleteGstReconRun(runId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "Only partners/managers can delete reconciliation runs." }
  }
  await prisma.gstReconRun.delete({ where: { id: runId } }).catch(() => null)
  revalidatePath("/gst-reconciliation")
  return { success: true }
}

/** Clients that can be reconciled (need a GSTIN on file), for the picker. */
export async function getReconClients() {
  const session = await requireAuth()
  return prisma.client.findMany({
    where: { ...(await getClientScopeWhere(session)), deletedAt: null },
    select: { id: true, name: true, gstin: true },
    orderBy: { name: "asc" },
  })
}
