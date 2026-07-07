import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"

import { tenantContext } from "@/lib/tenant/context"

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
  basePrisma: PrismaClient | undefined
}

/**
 * Recycle bin (soft delete): Client, Document, and Invoice carry a `deletedAt`
 * column. Rather than add `deletedAt: null` to ~120 query sites (and risk
 * missing one → deleted rows reappearing), we filter centrally here: list-style
 * reads on these models get `deletedAt: null` injected automatically.
 *
 * Safe by construction: every existing row has deletedAt = null, so this is a
 * no-op until something is actually soft-deleted (only app/actions/trash.ts and
 * the delete actions do that). A caller that sets `deletedAt` explicitly (the
 * Trash page) opts out and sees deleted rows.
 *
 * `findUnique` is intentionally NOT filtered — it takes only unique fields, and
 * restore/purge/detail-by-id must still resolve a soft-deleted row.
 */
const SOFT_DELETE_MODELS = new Set(["Client", "Document", "Invoice"])
const FILTERED_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
])

/**
 * Multi-tenant isolation. Every model below carries a required `firmId`.
 * When a request has a tenant context (set by requireAuth), EVERY operation on
 * these models is transparently firm-scoped:
 *
 *  - reads/counts get `firmId` added to `where`
 *  - unique reads/writes (findUnique/update/delete/upsert) get `firmId` added
 *    as a filtered-unique condition — cross-firm access by guessed id becomes
 *    "not found", closing the whole IDOR class in one place
 *  - creates get `firmId` stamped into `data` (caller-supplied values are
 *    overridden — a request can never write into another firm)
 *
 * System context (cron, backfill, public quotation portal) has no store and is
 * intentionally unscoped; cron loops call tenantContext.run() per firm.
 */
const TENANT_MODELS = new Set([
  "User", "Employee", "Client", "ClientGroup", "Task", "TaskAutomation",
  "ComplianceSchedule", "ComplianceEvent", "Document", "DocumentRequest",
  "Message", "MessageTemplate", "Invoice", "Reminder", "ActivityLog",
  "AuditLog", "EmployeeSession", "EmployeeActivity", "AttendanceRecord",
  "Lead", "Quotation", "QuotationFollowUp", "ClientTimelineEvent",
  "StatutoryRegistration", "DscRecord", "UdinRecord", "JobTemplate",
  "TimeEntry", "GstReconRun", "ItrComputation", "TaxNotice",
  "FinancialStatement", "FirmSettings",
])

const WHERE_OPS = new Set([
  "findMany", "findFirst", "findFirstOrThrow",
  "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy",
  "update", "updateMany", "delete", "deleteMany",
])

function createBaseClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  // Fail fast if the DB host is unreachable (e.g. wrong/old connection string
  // on a serverless host) instead of hanging the request forever.
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
    statement_timeout: 20000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

/**
 * Unextended client — used ONLY by the tenant resolver (lib/tenant/resolve)
 * to look up the session user's firm without recursing into the extension,
 * and by one-off system scripts. Application code must import `prisma`.
 */
export const basePrisma = globalForPrisma.basePrisma ?? createBaseClient()

function createPrismaClient() {
  return basePrisma
    .$extends({
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }) {
            if (
              model &&
              SOFT_DELETE_MODELS.has(model) &&
              FILTERED_OPERATIONS.has(operation)
            ) {
              const a = (args ?? {}) as { where?: Record<string, unknown> }
              const where = a.where ?? {}
              // Only inject when the caller hasn't spoken about deletedAt — this
              // lets the Trash page pass `deletedAt: { not: null }` to opt out.
              if (!("deletedAt" in where)) {
                a.where = { ...where, deletedAt: null }
                return query(a)
              }
            }
            return query(args)
          },
        },
      },
    })
    .$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) {
              return query(args)
            }

            // Explicit store first (cron per-firm loops); otherwise derive the
            // firm from the request's auth session (memoized per request).
            // NOTE: enterWith() from inside an awaited guard does NOT survive
            // back into the caller, so request paths rely on this resolver.
            let firmId = tenantContext.getStore()?.firmId
            if (!firmId) {
              const { resolveRequestFirmId } = await import("@/lib/tenant/resolve")
              firmId = (await resolveRequestFirmId()) ?? undefined
            }
            if (!firmId) {
              return query(args)
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const a = (args ?? {}) as any

            if (WHERE_OPS.has(operation)) {
              a.where = { ...(a.where ?? {}), firmId }
            } else if (operation === "upsert") {
              a.where = { ...(a.where ?? {}), firmId }
              a.create = { ...(a.create ?? {}), firmId }
            } else if (operation === "create") {
              a.data = { ...(a.data ?? {}), firmId }
            } else if (
              operation === "createMany" ||
              operation === "createManyAndReturn"
            ) {
              if (Array.isArray(a.data)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                a.data = a.data.map((d: any) => ({ ...d, firmId }))
              } else if (a.data) {
                a.data = { ...a.data, firmId }
              }
            }

            return query(a)
          },
        },
      },
    })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.basePrisma = basePrisma
}
