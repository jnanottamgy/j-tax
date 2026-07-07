import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Per-request tenant context.
 *
 * `requireAuth` resolves the signed-in user's firm and calls
 * `tenantContext.enterWith({ firmId })`; from that point every Prisma query in
 * the request is automatically firm-scoped by the extension in lib/prisma.ts.
 *
 * Cron/system code runs UNSCOPED by default (no store). To process one firm's
 * slice, wrap the work: `tenantContext.run({ firmId }, () => ...)` — the same
 * queries then self-scope, and per-firm settings resolve correctly.
 */
export type TenantStore = { firmId: string }

export const tenantContext = new AsyncLocalStorage<TenantStore>()

/** The active firm id, or undefined in system/unauthenticated context. */
export function currentFirmId(): string | undefined {
  return tenantContext.getStore()?.firmId
}
