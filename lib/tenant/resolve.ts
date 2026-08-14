import { cache } from "react"

/**
 * Request-scoped firm resolution for the Prisma tenant extension.
 *
 * Why this exists: `AsyncLocalStorage.enterWith()` called inside an awaited
 * guard does NOT survive the await boundary back into the calling server
 * action — the store evaporates and queries would run unscoped. Instead of
 * relying on the guard to establish context, the Prisma extension calls this
 * resolver, which derives the firm from the request's own auth cookie.
 *
 * `cache()` memoizes per request (RSC/server-action scope), so the session +
 * user lookup happens at most once per request regardless of query count.
 *
 * Outside a Next request (cron ticks, scripts): `getSession`/`cookies()`
 * throw or return null → resolves null → queries stay unscoped, and cron
 * provides explicit scope via `tenantContext.run()` per firm.
 *
 * IMPORTANT: uses `basePrisma` (the unextended client) — resolving through
 * the extended client would recurse into this resolver.
 */
/**
 * Per-request slot for a firm the guard has already established.
 *
 * `cache()` on a sync factory gives one object per request, so writing to it is
 * a request-local assignment.
 */
const requestFirmSlot = cache((): { firmId: string | null } => ({ firmId: null }))

/**
 * Tell the resolver the firm, when a guard has just worked it out.
 *
 * Needed because the lookup below memoizes its answer for the whole request,
 * including a `null`. A client-portal login signing in for the first time has
 * no `User` row yet — that row is what the guard is about to create — so the
 * resolver returns null, caches it, and every query for the rest of that
 * request runs unscoped. Priming closes that window, and does the same job for
 * `tenantContext.enterWith()`, whose store does not survive the await back out
 * of the guard.
 *
 * Only ever narrows to a real firm; there is no way to prime it to null.
 */
export function primeRequestFirmId(firmId: string): void {
  if (!firmId) return
  try {
    requestFirmSlot().firmId = firmId
  } catch {
    // Outside a request scope (cron, scripts) there is nothing to prime —
    // those paths carry explicit scope via tenantContext.run().
  }
}

const lookupRequestFirmId = cache(async (): Promise<string | null> => {
  try {
    const { getSession } = await import("@/lib/auth/session")
    const session = await getSession()
    if (!session?.user?.id) return null

    const { basePrisma } = await import("@/lib/prisma")
    const user = await basePrisma.user.findUnique({
      where: { id: session.user.id },
      select: { firmId: true },
    })
    return user?.firmId ?? null
  } catch {
    // No request scope (cron/script) or transient auth failure → unscoped;
    // guards still enforce authentication before any data is returned.
    return null
  }
})

export async function resolveRequestFirmId(): Promise<string | null> {
  let slot: { firmId: string | null } | null = null
  try {
    slot = requestFirmSlot()
  } catch {
    slot = null
  }
  if (slot?.firmId) return slot.firmId

  const resolved = await lookupRequestFirmId()
  if (resolved && slot) slot.firmId = resolved
  return resolved
}
