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
export const resolveRequestFirmId = cache(async (): Promise<string | null> => {
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
