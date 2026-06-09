// Caching utilities for performance optimization
// This provides a simple in-memory cache with TTL support

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<any>>()

export function setCache<T>(key: string, value: T, ttl: number = 60000): void {
  const expiresAt = Date.now() + ttl
  cache.set(key, { value, expiresAt })
}

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key)
  
  if (!entry) {
    return null
  }
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  
  return entry.value as T
}

export function hasCache(key: string): boolean {
  const entry = cache.get(key)
  
  if (!entry) {
    return false
  }
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return false
  }
  
  return true
}

export function deleteCache(key: string): void {
  cache.delete(key)
}

export function clearCache(): void {
  cache.clear()
}

export function clearExpiredCache(): void {
  const now = Date.now()
  
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key)
    }
  }
}

// Clear expired cache every 5 minutes
if (typeof window === "undefined") {
  setInterval(clearExpiredCache, 5 * 60 * 1000)
}

// Cache decorator for async functions
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ttl: number = 60000,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)
    
    const cached = getCache(key)
    if (cached !== null) {
      return cached
    }
    
    const result = await fn(...args)
    setCache(key, result, ttl)
    
    return result
  }) as T
}

// Cache keys for common operations
export const CacheKeys = {
  CLIENTS: "clients",
  CLIENT_BY_ID: (id: string) => `client:${id}`,
  TASKS: "tasks",
  TASK_BY_ID: (id: string) => `task:${id}`,
  EMPLOYEES: "employees",
  INVOICES: "invoices",
  DOCUMENTS: "documents",
  COMPLIANCE_EVENTS: "compliance_events",
  DASHBOARD_METRICS: "dashboard_metrics",
  SEARCH_RESULTS: (query: string) => `search:${query}`,
  USER_PERMISSIONS: (userId: string) => `permissions:${userId}`,
}
