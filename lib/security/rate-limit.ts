/**
 * In-process rate limiter.
 *
 * NOTE: In a serverless environment (Vercel, AWS Lambda) each function
 * instance has its own memory, so this store is NOT shared across instances
 * and resets on cold starts. This is acceptable for basic abuse prevention
 * on a single instance. For distributed rate limiting, replace this with a
 * Redis-backed solution (e.g. Upstash).
 *
 * The implementation is intentionally fail-open: if the store is cold (fresh
 * instance) the first N requests are always allowed, which is the correct
 * behaviour — we never want to block legitimate traffic due to a cold start.
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Use a Map with a bounded size to prevent unbounded memory growth.
const MAX_STORE_SIZE = 10_000
const rateLimitStore = new Map<string, RateLimitEntry>()

function pruneExpired(): void {
  if (rateLimitStore.size < MAX_STORE_SIZE) return
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

export function rateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60_000
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now()

  pruneExpired()

  const existing = rateLimitStore.get(identifier)

  // If no entry or the window has expired, start a fresh window
  if (!existing || existing.resetTime <= now) {
    const entry: RateLimitEntry = { count: 1, resetTime: now + windowMs }
    rateLimitStore.set(identifier, entry)
    return { success: true, remaining: limit - 1, resetTime: entry.resetTime }
  }

  // Increment within the current window
  existing.count += 1
  rateLimitStore.set(identifier, existing)

  const success = existing.count <= limit
  const remaining = Math.max(0, limit - existing.count)

  return { success, remaining, resetTime: existing.resetTime }
}

export function rateLimitByIP(
  ip: string,
  limit: number = 100,
  windowMs: number = 60_000
) {
  return rateLimit(`ip:${ip}`, limit, windowMs)
}

export function rateLimitByUser(
  userId: string,
  limit: number = 200,
  windowMs: number = 60_000
) {
  return rateLimit(`user:${userId}`, limit, windowMs)
}

export function rateLimitByEndpoint(
  endpoint: string,
  limit: number = 50,
  windowMs: number = 60_000
) {
  return rateLimit(`endpoint:${endpoint}`, limit, windowMs)
}
