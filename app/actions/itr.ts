"use server"

/**
 * ITR computation — server actions. The engine (lib/tax/itr) is pure; the
 * client computes live for instant feedback, but results are ALWAYS
 * recomputed here from raw inputs before persisting.
 */

import { revalidatePath } from "next/cache"
import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById, getClientScopeWhere } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { computeItr, type ItrInputs, type FinancialYearKey, type AgeBand } from "@/lib/tax/itr"

/** Inputs over the wire — dates as ISO strings, everything else plain. */
export type WireItrInputs = Omit<ItrInputs, "filingDate" | "fy" | "ageBand"> & {
  fy: FinancialYearKey
  ageBand: AgeBand
  filingDate?: string | null
}

function toEngineInputs(w: WireItrInputs): ItrInputs {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    fy: w.fy,
    ageBand: w.ageBand,
    salaryGross: n(w.salaryGross),
    housePropertyIncome: n(w.housePropertyIncome),
    businessIncome: n(w.businessIncome),
    otherSourcesIncome: n(w.otherSourcesIncome),
    stcg111A: n(w.stcg111A),
    ltcg112A: n(w.ltcg112A),
    ltcgOther: n(w.ltcgOther),
    deductions: {
      s80C: n(w.deductions?.s80C),
      s80CCD1B: n(w.deductions?.s80CCD1B),
      s80D: n(w.deductions?.s80D),
      s80G: n(w.deductions?.s80G),
      s80TTA_TTB: n(w.deductions?.s80TTA_TTB),
      others: n(w.deductions?.others),
      nps80CCD2: n(w.deductions?.nps80CCD2),
    },
    tds: n(w.tds),
    advanceTax: {
      q1: n(w.advanceTax?.q1),
      q2: n(w.advanceTax?.q2),
      q3: n(w.advanceTax?.q3),
      q4: n(w.advanceTax?.q4),
    },
    filingDate: w.filingDate ? new Date(w.filingDate) : undefined,
  }
}

export async function saveItrComputation(input: {
  clientId: string
  inputs: WireItrInputs
  regimeChosen?: "OLD" | "NEW" | null
  /** Update an existing sheet instead of creating a new one */
  computationId?: string
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch {
    return { success: false, error: "Not signed in." }
  }
  const userId = session.user.id

  // Employees may only compute for their assigned clients.
  if (!(await canAccessClientById(session, input.clientId))) {
    return { success: false, error: "You can only save computations for your assigned clients." }
  }
  // When updating an existing sheet, its current client must be accessible too
  // (prevents hijacking another client's saved sheet by swapping clientId).
  if (input.computationId) {
    const existing = await prisma.itrComputation.findUnique({
      where: { id: input.computationId },
      select: { clientId: true },
    })
    if (!existing) return { success: false, error: "Computation not found." }
    if (!(await canAccessClientById(session, existing.clientId))) {
      return { success: false, error: "You can only edit computations for your assigned clients." }
    }
  }

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true },
  })
  if (!client) return { success: false, error: "Client not found." }

  const engineInputs = toEngineInputs(input.inputs)
  const results = computeItr(engineInputs)
  const payload = {
    clientId: client.id,
    financialYear: engineInputs.fy,
    regimeChosen: input.regimeChosen ?? results.recommended,
    inputs: JSON.parse(JSON.stringify(input.inputs)) as object,
    results: JSON.parse(JSON.stringify(results)) as object,
  }

  const row = input.computationId
    ? await prisma.itrComputation.update({
        where: { id: input.computationId },
        data: payload,
      })
    : await prisma.itrComputation.create({
        data: { ...payload, createdBy: userId },
      })

  revalidatePath("/itr-computation")
  return { success: true, id: row.id }
}

export async function listItrComputations() {
  const session = await requireAuth()
  // Employees see only their assigned clients' computations.
  return prisma.itrComputation.findMany({
    where: { client: await getClientScopeWhere(session) },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { client: { select: { id: true, name: true, pan: true } } },
  })
}

export async function getItrComputation(id: string) {
  const session = await requireAuth()
  const row = await prisma.itrComputation.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, pan: true } } },
  })
  if (!row) return null
  // Employees may only open computations for their assigned clients.
  if (!(await canAccessClientById(session, row.clientId))) return null
  return row
}

export async function deleteItrComputation(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "Only partners/managers can delete computations." }
  }
  await prisma.itrComputation.delete({ where: { id } }).catch(() => null)
  revalidatePath("/itr-computation")
  return { success: true }
}

export async function getItrClients() {
  const session = await requireAuth()
  return prisma.client.findMany({
    where: { ...(await getClientScopeWhere(session)), deletedAt: null },
    select: { id: true, name: true, pan: true },
    orderBy: { name: "asc" },
  })
}
