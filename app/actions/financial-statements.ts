"use server"

/**
 * Financial statements — server actions. Statements are ALWAYS rebuilt from
 * the mapped ledgers here (lib/accounts is pure), never trusted from the
 * browser.
 */

import { revalidatePath } from "next/cache"
import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { canAccessClientById, getClientScopeWhere } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"
import { BUCKETS, type BucketKey } from "@/lib/accounts/buckets"
import { buildStatements, type MappedLedger, type Statements } from "@/lib/accounts/statements"

const MAX_LEDGERS = 5_000

export type WireLedger = {
  name: string
  group?: string | null
  debit: number
  credit: number
  bucket: BucketKey
  matched: boolean
}

function sanitizeLedgers(rows: WireLedger[]): MappedLedger[] {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return rows
    .filter((r) => typeof r?.name === "string" && r.name.trim() && BUCKETS[r.bucket])
    .map((r) => ({
      name: r.name.trim().slice(0, 200),
      group: r.group?.trim() || null,
      debit: n(r.debit),
      credit: n(r.credit),
      bucket: r.bucket,
      matched: Boolean(r.matched),
    }))
}

export async function saveFinancialStatement(input: {
  clientId: string
  financialYear: string
  ledgers: WireLedger[]
  /** Update an existing statement instead of creating a new one */
  statementId?: string
}): Promise<
  | { success: true; id: string; statements: Statements }
  | { success: false; error: string }
> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth()
  } catch {
    return { success: false, error: "Not signed in." }
  }
  const userId = session.user.id

  // Employees may only prepare statements for their assigned clients.
  if (!(await canAccessClientById(session, input.clientId))) {
    return { success: false, error: "You can only save statements for your assigned clients." }
  }
  if (input.statementId) {
    const existing = await prisma.financialStatement.findUnique({
      where: { id: input.statementId },
      select: { clientId: true },
    })
    if (!existing) return { success: false, error: "Statement not found." }
    if (!(await canAccessClientById(session, existing.clientId))) {
      return { success: false, error: "You can only edit statements for your assigned clients." }
    }
  }

  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true },
  })
  if (!client) return { success: false, error: "Client not found." }

  const fy = input.financialYear.trim()
  if (!/^\d{4}-\d{2}$/.test(fy)) {
    return { success: false, error: 'Financial year must look like "2025-26".' }
  }

  const ledgers = sanitizeLedgers(input.ledgers)
  if (ledgers.length === 0) {
    return { success: false, error: "No usable ledger rows to save." }
  }
  if (ledgers.length > MAX_LEDGERS) {
    return { success: false, error: `Too many ledgers (cap ${MAX_LEDGERS}).` }
  }

  const statements = buildStatements(ledgers)

  const payload = {
    clientId: client.id,
    financialYear: fy,
    ledgers: JSON.parse(JSON.stringify(ledgers)) as object,
    statements: JSON.parse(JSON.stringify(statements)) as object,
  }

  const row = input.statementId
    ? await prisma.financialStatement.update({
        where: { id: input.statementId },
        data: payload,
      })
    : await prisma.financialStatement.create({
        data: { ...payload, createdBy: userId },
      })

  revalidatePath("/financial-statements")
  return { success: true, id: row.id, statements }
}

export async function listFinancialStatements() {
  const session = await requireAuth()
  // Employees see only their assigned clients' statements.
  return prisma.financialStatement.findMany({
    where: { client: await getClientScopeWhere(session) },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { client: { select: { id: true, name: true } } },
  })
}

export async function getFinancialStatement(id: string) {
  const session = await requireAuth()
  const row = await prisma.financialStatement.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } } },
  })
  if (!row) return null
  // Employees may only open statements for their assigned clients.
  if (!(await canAccessClientById(session, row.clientId))) return null
  return row
}

export async function deleteFinancialStatement(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "Only partners/managers can delete statements." }
  }
  await prisma.financialStatement.delete({ where: { id } }).catch(() => null)
  revalidatePath("/financial-statements")
  return { success: true }
}

export async function getFsClients() {
  const session = await requireAuth()
  return prisma.client.findMany({
    where: { ...(await getClientScopeWhere(session)), deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}
