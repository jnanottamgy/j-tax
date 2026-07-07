"use server"

/**
 * Bulk client CSV import/export.
 *
 * Import reuses createClientWithOnboarding per row, so every imported client
 * is fully provisioned (services, tasks, compliance schedules, reminders) —
 * identical to a client added through the wizard. Each row passes the same
 * createClientSchema (GSTIN checksum, PAN structure, GSTIN↔PAN cross-check).
 */

import { revalidatePath } from "next/cache"
import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { createClientWithOnboarding } from "@/lib/clients/queries"
import { createClientSchema } from "@/lib/validations/client"
import { toCsv } from "@/lib/csv/parse"

export type ImportClientRow = {
  name: string
  gstin?: string
  pan?: string
  email?: string
  phone?: string
  whatsapp?: string
  address?: string
  notes?: string
  priority?: string
  /** Pipe/comma-separated service names, e.g. "GST_RETURN|INCOME_TAX" */
  services?: string
}

export type ImportRowResult = {
  /** 1-based data row number (excluding the header row) */
  row: number
  name: string
  status: "created" | "skipped" | "invalid"
  reason?: string
}

export type ImportClientsResult = {
  success: boolean
  error?: string
  created: number
  skipped: number
  invalid: number
  results: ImportRowResult[]
}

const MAX_IMPORT_ROWS = 500

const SERVICE_ALIASES: Record<string, string> = {
  GST_RETURN: "GST_RETURN",
  GST: "GST_RETURN",
  GSTRETURN: "GST_RETURN",
  INCOME_TAX: "INCOME_TAX",
  INCOMETAX: "INCOME_TAX",
  ITR: "INCOME_TAX",
  IT: "INCOME_TAX",
  TDS: "TDS",
  PAYROLL: "PAYROLL",
  BOOKKEEPING: "BOOKKEEPING",
  BOOKS: "BOOKKEEPING",
  ACCOUNTING: "BOOKKEEPING",
  AUDIT: "AUDIT",
  COMPANY_LAW: "COMPANY_LAW",
  COMPANYLAW: "COMPANY_LAW",
  ROC: "COMPANY_LAW",
  MCA: "COMPANY_LAW",
  OTHER: "OTHER",
}

/** Sensible default filing frequency per service type. */
const DEFAULT_FREQUENCY: Record<string, "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ONE_TIME"> = {
  GST_RETURN: "MONTHLY",
  TDS: "QUARTERLY",
  INCOME_TAX: "ANNUAL",
  AUDIT: "ANNUAL",
  COMPANY_LAW: "ANNUAL",
  PAYROLL: "MONTHLY",
  BOOKKEEPING: "MONTHLY",
  OTHER: "ONE_TIME",
}

function parseServices(raw: string | undefined) {
  const tokens = (raw ?? "")
    .split(/[|,;/]+/)
    .map((t) => t.trim().toUpperCase().replace(/[\s-]+/g, "_"))
    .filter(Boolean)

  const resolved = new Set<string>()
  const unknown: string[] = []
  for (const token of tokens) {
    const match = SERVICE_ALIASES[token] ?? SERVICE_ALIASES[token.replace(/_/g, "")]
    if (match) resolved.add(match)
    else unknown.push(token)
  }
  // No services column / nothing recognised → provision as OTHER so the
  // client master is still created; services can be refined in the UI later.
  if (resolved.size === 0) resolved.add("OTHER")

  // OTHER requires a name — reuse the unrecognised tokens (title-cased) when we
  // have them, else a sensible default. Keeps imports valid and meaningful.
  const otherName =
    (unknown.length
      ? unknown
          .map((t) =>
            t
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())
          )
          .join(", ")
      : "Other services"
    ).slice(0, 120)

  return {
    services: [...resolved].map((serviceType) => ({
      serviceType: serviceType as
        | "GST_RETURN" | "INCOME_TAX" | "TDS" | "PAYROLL"
        | "BOOKKEEPING" | "AUDIT" | "COMPANY_LAW" | "OTHER",
      frequency: DEFAULT_FREQUENCY[serviceType],
      ...(serviceType === "OTHER" ? { customName: otherName } : {}),
    })),
    unknown,
  }
}

function normalizePriority(raw: string | undefined): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const p = (raw ?? "").trim().toUpperCase()
  if (p === "LOW" || p === "HIGH" || p === "CRITICAL") return p
  if (p === "URGENT") return "CRITICAL"
  return "MEDIUM"
}

export async function importClients(rows: ImportClientRow[]): Promise<ImportClientsResult> {
  try {
    await requirePartnerOrManager()
  } catch {
    return {
      success: false,
      error: "You don't have permission to import clients.",
      created: 0, skipped: 0, invalid: 0, results: [],
    }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "No rows to import.", created: 0, skipped: 0, invalid: 0, results: [] }
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      success: false,
      error: `Too many rows (${rows.length}). Import at most ${MAX_IMPORT_ROWS} at a time.`,
      created: 0, skipped: 0, invalid: 0, results: [],
    }
  }

  // Pre-fetch existing identifiers once for dedupe (soft-deleted excluded —
  // restoring from the recycle bin beats importing a duplicate).
  const existing = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { name: true, gstin: true, pan: true },
  })
  const existingNames = new Set(existing.map((c) => c.name.trim().toLowerCase()))
  const existingGstins = new Set(existing.map((c) => c.gstin).filter(Boolean) as string[])
  const existingPans = new Set(existing.map((c) => c.pan).filter(Boolean) as string[])

  // Track in-file duplicates too
  const seenNames = new Set<string>()
  const seenGstins = new Set<string>()
  const seenPans = new Set<string>()

  const results: ImportRowResult[] = []
  let created = 0
  let skipped = 0
  let invalid = 0

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNo = i + 1
    const name = (raw.name ?? "").trim()
    const label = name || `(row ${rowNo})`

    const { services, unknown } = parseServices(raw.services)

    const parsed = createClientSchema.safeParse({
      name,
      gstin: raw.gstin,
      pan: raw.pan,
      email: raw.email,
      phone: raw.phone,
      whatsapp: raw.whatsapp,
      address: raw.address,
      notes: raw.notes,
      priority: normalizePriority(raw.priority),
      services,
    })

    if (!parsed.success) {
      invalid++
      const first = parsed.error.issues[0]
      results.push({
        row: rowNo,
        name: label,
        status: "invalid",
        reason: `${first.path.join(".")}: ${first.message}`,
      })
      continue
    }

    const input = parsed.data
    const nameKey = input.name.trim().toLowerCase()

    // Dedupe: DB + earlier rows in this same file
    let dupeReason: string | null = null
    if (input.gstin && (existingGstins.has(input.gstin) || seenGstins.has(input.gstin))) {
      dupeReason = `GSTIN ${input.gstin} already exists`
    } else if (input.pan && (existingPans.has(input.pan) || seenPans.has(input.pan))) {
      dupeReason = `PAN ${input.pan} already exists`
    } else if (existingNames.has(nameKey) || seenNames.has(nameKey)) {
      dupeReason = `a client named "${input.name}" already exists`
    }
    if (dupeReason) {
      skipped++
      results.push({ row: rowNo, name: label, status: "skipped", reason: dupeReason })
      continue
    }

    try {
      await createClientWithOnboarding(input)
      created++
      seenNames.add(nameKey)
      if (input.gstin) seenGstins.add(input.gstin)
      if (input.pan) seenPans.add(input.pan)
      results.push({
        row: rowNo,
        name: input.name,
        status: "created",
        reason: unknown.length ? `unrecognised services ignored: ${unknown.join(", ")}` : undefined,
      })
    } catch (error) {
      invalid++
      results.push({
        row: rowNo,
        name: label,
        status: "invalid",
        reason: error instanceof Error ? error.message : "Unexpected error while creating",
      })
    }
  }

  revalidatePath("/clients")
  return { success: true, created, skipped, invalid, results }
}

/** Export all active clients (with services) as CSV text for download. */
export async function exportClientsCsv(): Promise<
  { success: true; csv: string; filename: string } | { success: false; error: string }
> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, error: "You don't have permission to export clients." }
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    include: { services: { where: { isActive: true } } },
    orderBy: { clientCode: "asc" },
  })

  const headers = [
    "clientCode", "name", "gstin", "pan", "email", "phone", "whatsapp",
    "address", "status", "priority", "services", "notes", "createdAt",
  ]
  const rows = clients.map((c) => [
    c.clientCode,
    c.name,
    c.gstin ?? "",
    c.pan ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.whatsapp ?? "",
    c.address ?? "",
    c.status,
    c.priority,
    c.services.map((s) => s.serviceType).join("|"),
    c.notes ?? "",
    c.createdAt.toISOString().slice(0, 10),
  ])

  const stamp = new Date().toISOString().slice(0, 10)
  return { success: true, csv: toCsv(headers, rows), filename: `clients-${stamp}.csv` }
}
