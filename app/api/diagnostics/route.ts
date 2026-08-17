import { NextResponse } from "next/server"

import { requirePartner } from "@/lib/auth/guards"
import { basePrisma } from "@/lib/prisma"
import { tenantContext } from "@/lib/tenant/context"

/**
 * Tells you which query is failing, instead of making you read a stack trace.
 *
 * When a page dies, the error boundary shows a reference number and nothing
 * else. The real error is in the hosting runtime log, which is not always to
 * hand — and diagnosing a live problem by guessing from source is slow and
 * frequently wrong.
 *
 * So this runs the same reads the dashboard runs, one at a time, and reports
 * each one's outcome. A schema that was never migrated shows up as a row with
 * a Prisma code against the exact model whose table or enum is missing.
 *
 * Partner-only, and it returns no data — only whether each read worked, and the
 * error code when it did not. Messages are truncated and connection strings are
 * stripped, because Prisma puts the database host in some of them.
 */

export const dynamic = "force-dynamic"

type Check = { name: string; ok: boolean; code?: string; error?: string }

function sanitise(err: unknown): { code?: string; error: string } {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : undefined
  let message = err instanceof Error ? err.message : String(err)
  // Prisma embeds the connection string in some connection errors.
  message = message.replace(/postgres(ql)?:\/\/[^\s"']+/gi, "[connection string removed]")
  message = message.replace(/\s+/g, " ").trim()
  return { code, error: message.slice(0, 300) }
}

async function check(name: string, fn: () => Promise<unknown>): Promise<Check> {
  try {
    await fn()
    return { name, ok: true }
  } catch (err) {
    return { name, ok: false, ...sanitise(err) }
  }
}

export async function GET() {
  let firmId: string
  try {
    const session = await requirePartner()
    firmId = session.user.firmId ?? ""
  } catch {
    return NextResponse.json({ error: "Partner access required." }, { status: 403 })
  }

  const now = new Date()

  // basePrisma throughout: this must report on the database itself, not on
  // whether tenant scoping happens to resolve.
  const checks: Check[] = []

  checks.push(await check("database connection", () => basePrisma.$queryRaw`SELECT 1`))

  // One read per model the dashboard touches. A model whose table or enum is
  // missing from the database fails here and names itself.
  const models: Array<[string, () => Promise<unknown>]> = [
    ["firm", () => basePrisma.firm.count()],
    ["user", () => basePrisma.user.count()],
    ["employee", () => basePrisma.employee.count()],
    ["firmSettings", () => basePrisma.firmSettings.count()],
    ["client", () => basePrisma.client.count()],
    ["task", () => basePrisma.task.count()],
    ["invoice", () => basePrisma.invoice.count()],
    ["complianceEvent", () => basePrisma.complianceEvent.count()],
    ["activityLog", () => basePrisma.activityLog.count()],
    ["lead", () => basePrisma.lead.count()],
    ["quotation", () => basePrisma.quotation.count()],
    ["timeEntry", () => basePrisma.timeEntry.count()],
    ["creditNote", () => basePrisma.creditNote.count()],
    ["employeeLeave", () => basePrisma.employeeLeave.count()],
    ["employeeSession", () => basePrisma.employeeSession.count()],
    ["attendanceRecord", () => basePrisma.attendanceRecord.count()],
    ["filingRecord", () => basePrisma.filingRecord.count()],
    ["udinRecord", () => basePrisma.udinRecord.count()],
    ["engagementLetter", () => basePrisma.engagementLetter.count()],
    ["peerReview", () => basePrisma.peerReview.count()],
    ["clientAcceptance", () => basePrisma.clientAcceptance.count()],
  ]
  for (const [name, fn] of models) checks.push(await check(`table: ${name}`, fn))

  // Enum values are the other half of a stale schema, and they fail differently
  // — the table exists, but Postgres rejects a value the client sends. Every
  // one of these is filtered on by the dashboard.
  const enums: Array<[string, () => Promise<unknown>]> = [
    ["task.status FILED_DONE", () => basePrisma.task.count({ where: { status: "FILED_DONE" } })],
    ["task.status DATA_AWAITED", () => basePrisma.task.count({ where: { status: "DATA_AWAITED" } })],
    ["invoice.status OVERDUE", () => basePrisma.invoice.count({ where: { status: "OVERDUE" } })],
    ["invoice.status PARTIALLY_PAID", () => basePrisma.invoice.count({ where: { status: "PARTIALLY_PAID" } })],
    ["invoice.status WAIVED", () => basePrisma.invoice.count({ where: { status: "WAIVED" } })],
    ["client.status ACTIVE", () => basePrisma.client.count({ where: { status: "ACTIVE" } })],
    ["lead.status CLIENT_WILL_REVERT", () => basePrisma.lead.count({ where: { status: "CLIENT_WILL_REVERT" } })],
    ["lead.status WON", () => basePrisma.lead.count({ where: { status: "WON" } })],
    ["quotation.status PENDING_APPROVAL", () => basePrisma.quotation.count({ where: { status: "PENDING_APPROVAL" } })],
    ["quotation.status SUPERSEDED", () => basePrisma.quotation.count({ where: { status: "SUPERSEDED" } })],
    ["complianceEvent.status PENDING", () => basePrisma.complianceEvent.count({ where: { status: "PENDING" } })],
    ["attendance.status ON_LEAVE", () => basePrisma.attendanceRecord.count({ where: { status: "ON_LEAVE" } })],
  ]
  for (const [name, fn] of enums) checks.push(await check(`enum: ${name}`, fn))

  // Columns added recently enough that a database which was never migrated
  // will not have them. Selecting one is what makes the omission visible.
  const columns: Array<[string, () => Promise<unknown>]> = [
    ["employee.billingRatePerHour", () =>
      basePrisma.employee.findFirst({ select: { billingRatePerHour: true } })],
    ["user.onboardingCompleted", () =>
      basePrisma.user.findFirst({ select: { onboardingCompleted: true, onboardingStep: true } })],
    ["firm.trialEndsAt", () => basePrisma.firm.findFirst({ select: { trialEndsAt: true, plan: true, status: true } })],
    ["firmSettings.invoiceApprovalLimit", () =>
      basePrisma.firmSettings.findFirst({ select: { invoiceApprovalLimit: true } })],
    ["task.reviewerEmployeeId", () =>
      basePrisma.task.findFirst({ select: { reviewerEmployeeId: true, acceptanceStatus: true } })],
    ["invoice.requiresApproval", () =>
      basePrisma.invoice.findFirst({ select: { requiresApproval: true, approvedAt: true } })],
  ]
  for (const [name, fn] of columns) checks.push(await check(`column: ${name}`, fn))

  // Finally the aggregates the dashboard actually runs, under tenant scope —
  // this is the closest thing to reproducing the failing page.
  checks.push(
    await check("dashboard: invoice aggregate", () =>
      tenantContext.run({ firmId }, () =>
        basePrisma.invoice.aggregate({
          _sum: { amount: true, paidAmount: true, outstandingAmount: true },
          _count: true,
        })
      )
    )
  )
  checks.push(
    await check("dashboard: task groupBy status", () =>
      tenantContext.run({ firmId }, () => basePrisma.task.groupBy({ by: ["status"], _count: true }))
    )
  )
  checks.push(
    await check("dashboard: quotation pipeline sum", () =>
      tenantContext.run({ firmId }, () =>
        basePrisma.quotation.aggregate({
          where: { status: { in: ["SENT", "VIEWED", "PENDING_APPROVAL", "APPROVED"] } },
          _sum: { total: true },
        })
      )
    )
  )
  checks.push(
    await check("dashboard: high-risk clients", () =>
      tenantContext.run({ firmId }, () =>
        basePrisma.client.findMany({
          where: { tasks: { some: { dueDate: { lt: now }, status: { not: "FILED_DONE" } } } },
          select: {
            id: true,
            _count: {
              select: { tasks: { where: { dueDate: { lt: now }, status: { not: "FILED_DONE" } } } },
            },
          },
          take: 5,
        })
      )
    )
  )

  const failed = checks.filter((c) => !c.ok)

  return NextResponse.json(
    {
      summary: failed.length === 0
        ? "All checks passed. The database schema matches what the app expects."
        : `${failed.length} of ${checks.length} checks FAILED — see 'failures'. ` +
          "Prisma codes P2021 (table missing) or P2022 (column missing), or an " +
          "invalid-enum error, all mean the schema was never pushed: run " +
          "`npx prisma db push`.",
      env: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
        CREDENTIAL_VAULT_KEY: Boolean(process.env.CREDENTIAL_VAULT_KEY),
        CRON_SECRET: Boolean(process.env.CRON_SECRET),
        RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      },
      failures: failed,
      passed: checks.filter((c) => c.ok).map((c) => c.name),
    },
    { status: 200 }
  )
}
