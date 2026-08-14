"use server"

import { revalidatePath } from "next/cache"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { provisionStaffAccount } from "@/lib/auth/provisioning"

/**
 * Adding a team in one go.
 *
 * Clients could be imported from a CSV since onboarding was built; staff could
 * not, so a firm moving ten people across opened ten dialogs and read out ten
 * temporary passwords. The work is identical each time, which is the definition
 * of something the app should be doing.
 *
 * Each row provisions a real login, exactly as the single-add path does — the
 * two differing at all is the bug this whole change set is about.
 */

export type ImportEmployeeRow = {
  name: string
  email: string
  department?: string
  /** "MANAGER" only when the caller is a Partner; anything else is EMPLOYEE. */
  role?: string
}

export type ImportEmployeeResult = {
  row: number
  name: string
  email: string
  status: "created" | "skipped" | "failed"
  /** Why it was skipped or failed — never a bare count. */
  message?: string
  /** Present when the invite could not be emailed and must be handed over. */
  tempPassword?: string
}

export type ImportEmployeesResult = {
  created: number
  skipped: number
  failed: number
  results: ImportEmployeeResult[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function importEmployees(
  rows: ImportEmployeeRow[]
): Promise<ImportEmployeesResult | { error: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to add team members." }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "Nothing to import." }
  }
  // Provisioning hits an external auth API per row, so a run has to stay
  // bounded — a 5,000-row paste would take minutes and time out halfway,
  // leaving a partly-created team with no record of where it stopped.
  if (rows.length > 200) {
    return { error: "Import up to 200 team members at a time." }
  }

  const results: ImportEmployeeResult[] = []
  let created = 0
  let skipped = 0
  let failed = 0

  // Existing emails in one query rather than one per row.
  const existing = await prisma.employee.findMany({ select: { email: true } })
  const taken = new Set(existing.map((e) => e.email?.toLowerCase()).filter(Boolean))

  // Duplicates inside the file itself, which a per-row DB check would miss
  // until the second one failed on a constraint.
  const seenInFile = new Set<string>()

  for (const [i, raw] of rows.entries()) {
    const rowNo = i + 1
    const name = (raw.name ?? "").trim()
    const email = (raw.email ?? "").trim().toLowerCase()

    if (!name || !email) {
      failed++
      results.push({ row: rowNo, name, email, status: "failed", message: "Name and email are both required." })
      continue
    }
    if (!EMAIL_RE.test(email)) {
      failed++
      results.push({ row: rowNo, name, email, status: "failed", message: "That is not a valid email address." })
      continue
    }
    if (taken.has(email) || seenInFile.has(email)) {
      skipped++
      results.push({
        row: rowNo,
        name,
        email,
        status: "skipped",
        message: seenInFile.has(email)
          ? "Appears twice in this file."
          : "Already on the team.",
      })
      continue
    }

    // Only a Partner may create a Manager; anything else falls back rather
    // than failing the row, so a stray value in a spreadsheet cannot quietly
    // grant somebody firm-wide access.
    const wantsManager = (raw.role ?? "").trim().toUpperCase() === "MANAGER"
    const role = wantsManager && session.user.role === "PARTNER" ? "MANAGER" : "EMPLOYEE"

    const provisioned = await provisionStaffAccount({ name, email, role })
    if (!provisioned.ok) {
      failed++
      results.push({ row: rowNo, name, email, status: "failed", message: provisioned.error })
      continue
    }

    try {
      await prisma.employee.create({
        data: {
          name,
          email,
          department: raw.department?.trim() || null,
          isActive: true,
          userId: provisioned.userId,
        },
      })
    } catch (err) {
      failed++
      results.push({
        row: rowNo,
        name,
        email,
        status: "failed",
        message: err instanceof Error ? "Could not save this team member." : "Unknown error.",
      })
      continue
    }

    seenInFile.add(email)
    created++
    results.push({
      row: rowNo,
      name,
      email,
      status: "created",
      message:
        role === "MANAGER"
          ? "Added as a Manager."
          : wantsManager
            ? "Added as an Employee — only a Partner can create Managers."
            : undefined,
      // Only when it could not be emailed: otherwise the password does not
      // need to be on screen at all.
      tempPassword: provisioned.emailSent ? undefined : (provisioned.tempPassword ?? undefined),
    })
  }

  revalidatePath("/employees")
  return { created, skipped, failed, results }
}
