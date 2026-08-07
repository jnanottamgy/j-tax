/**
 * Safety gate for destructive dev scripts (seeds, wipes, backfills).
 *
 * WHY THIS EXISTS
 * These scripts run OUTSIDE a request, so there is no tenant context. The
 * firm-scoping extension in lib/prisma.ts only injects `firmId` when it can
 * resolve a caller's firm — with no context it injects nothing, and a bare
 * `prisma.client.deleteMany()` therefore matches EVERY ROW OF EVERY FIRM on
 * the platform, not just the developer's own test data.
 *
 * On a shared multi-tenant database that turns `npm run db:seed` into
 * one-command, all-customer data loss. Hence: destructive scripts refuse to
 * run unless the operator opts in explicitly, and refuse outright in
 * production regardless of opt-in.
 *
 * To run one intentionally against a local/dev database:
 *   ALLOW_DESTRUCTIVE_SEED=yes npm run db:seed
 */

const OPT_IN = "ALLOW_DESTRUCTIVE_SEED"

export function assertDestructiveAllowed(scriptName: string): void {
  const env = process.env.NODE_ENV
  const vercel = process.env.VERCEL_ENV

  if (env === "production" || vercel === "production") {
    throw new Error(
      `\n\n⛔  ${scriptName} is DESTRUCTIVE and refuses to run in production.\n` +
        `    It issues unscoped deleteMany() calls that would wipe every firm.\n`
    )
  }

  if (process.env[OPT_IN] !== "yes") {
    throw new Error(
      `\n\n⛔  ${scriptName} is DESTRUCTIVE — it deletes ALL clients, invoices,\n` +
        `    payments, tasks and employees across EVERY firm in the connected\n` +
        `    database, then inserts fake demo data.\n\n` +
        `    Check DATABASE_URL points at a throwaway database, then re-run:\n` +
        `      ${OPT_IN}=yes <your command>\n`
    )
  }

  const url = process.env.DATABASE_URL ?? ""
  const host = url.replace(/^[a-z]+:\/\/[^@]*@/i, "").split(/[/?]/)[0]
  console.warn(
    `\n⚠️  ${scriptName}: destructive run authorised against ${host || "<unknown host>"}\n`
  )
}
