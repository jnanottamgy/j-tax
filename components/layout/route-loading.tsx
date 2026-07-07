import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared content-area skeleton for route-level loading.tsx files.
 * Keeps the shell (sidebar/header) visible while the page's server
 * components resolve — no more blank-screen navigations.
 */
export function RouteLoading({
  kpis = 4,
  table = true,
}: {
  kpis?: number
  table?: boolean
}) {
  return (
    <div className="space-y-6 p-4 md:p-8" role="status" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {kpis > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {table && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
