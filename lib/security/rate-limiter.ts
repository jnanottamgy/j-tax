/**
 * Rate Limiting for J-TAX
 * 
 * Implements rate limiting for API routes and server actions.
 * Uses a sliding window algorithm with in-memory storage.
 * For production, consider using Redis for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number
  firstAttempt: number
  blockedUntil: number | null
}

interface RateLimitConfig {
  windowMs: number      // Time window in milliseconds
  maxAttempts: number   // Maximum attempts per window
  blockDurationMs: number // Duration to block after exceeding limit
}

// Default configurations
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,    // 15 minutes
  maxAttempts: 100,             // 100 requests per window
  blockDurationMs: 15 * 60 * 1000, // 15 minute block
}

const LOGIN_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,    // 15 minutes
  maxAttempts: 5,               // 5 login attempts per window
  blockDurationMs: 15 * 60 * 1000, // 15 minute block
}

const API_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,         // 1 minute
  maxAttempts: 30,              // 30 requests per minute
  blockDurationMs: 60 * 1000,   // 1 minute block
}

// HIGH-06: In-memory store resets on serverless cold starts (Vercel).
// For true distributed rate limiting, replace with Redis (e.g. Upstash):
//   import { Ratelimit } from "@upstash/ratelimit"
//   import { Redis } from "@upstash/redis"
// This in-memory implementation still provides protection on long-lived
// servers and development environments.
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.blockedUntil && entry.blockedUntil < now) {
      store.delete(key)
    }
  }
}, 60 * 1000) // Run every minute

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
  blocked: boolean
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(identifier)

  // Check if blocked
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      blocked: true,
    }
  }

  // Initialize or reset if window expired
  if (!entry || now - entry.firstAttempt > config.windowMs) {
    store.set(identifier, {
      count: 1,
      firstAttempt: now,
      blockedUntil: null,
    })
    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetTime: now + config.windowMs,
      blocked: false,
    }
  }

  // Increment count
  entry.count++
  store.set(identifier, entry)

  // Check if limit exceeded
  if (entry.count > config.maxAttempts) {
    entry.blockedUntil = now + config.blockDurationMs
    store.set(identifier, entry)
    
    return {
      success: false,
      remaining: 0,
      resetTime: entry.blockedUntil,
      retryAfter: Math.ceil(config.blockDurationMs / 1000),
      blocked: true,
    }
  }

  return {
    success: true,
    remaining: config.maxAttempts - entry.count,
    resetTime: entry.firstAttempt + config.windowMs,
    blocked: false,
  }
}

/**
 * Rate limit for login attempts
 */
export function checkLoginRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`login:${ip}`, LOGIN_CONFIG)
}

/**
 * Rate limit for API requests
 */
export function checkApiRateLimit(ip: string): RateLimitResult {
  return checkRateLimit(`api:${ip}`, API_CONFIG)
}

/**
 * Rate limit for server actions
 */
export function checkActionRateLimit(userId: string, action: string): RateLimitResult {
  return checkRateLimit(`action:${userId}:${action}`, DEFAULT_CONFIG)
}

/**
 * Reset rate limit for an identifier (e.g., after successful login)
 */
export function resetRateLimit(identifier: string): void {
  store.delete(identifier)
}

/**
 * Get rate limit headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.blocked ? '0' : String(result.remaining + 1),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
    ...(result.retryAfter && { 'Retry-After': String(result.retryAfter) }),
  }
}

/**
 * Simple rate limit by IP (for proxy middleware compatibility)
 * @param ip - IP address or identifier
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimitByIP(ip: string, maxRequests: number, windowMs: number): RateLimitResult {
  const config: RateLimitConfig = {
    windowMs,
    maxAttempts: maxRequests,
    blockDurationMs: windowMs,
  }
  return checkRateLimit(`proxy:${ip}`, config)
}