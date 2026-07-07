"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ActivityTimeline } from "@/components/activity/activity-timeline"
import { getGlobalTimeline } from "@/app/actions/activity"

// Full fixed list of entity types written by lib/activity/logger.ts
const ENTITY_TYPES = ["CLIENT", "TASK", "INVOICE", "DOCUMENT", "EMPLOYEE", "COMPLIANCE"]

export function ActivityTimelineClient() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [entityFilter, setEntityFilter] = useState("ALL")
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const [limit] = useState(50)

  const loadActivities = useCallback(async (filter: string) => {
    try {
      setLoading(true)
      setLoadError(false)
      const result = await getGlobalTimeline(
        filter === "ALL" ? {} : { entityType: filter },
        limit,
        0
      )
      setLogs(result.logs)
      setHasMore(result.hasMore)
      setOffset(0)
    } catch (error) {
      console.error("Failed to load activities:", error)
      setLoadError(true)
      toast.error("Failed to load activities")
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Re-fetch from offset 0 whenever the entity-type filter changes
  useEffect(() => {
    loadActivities(entityFilter)
  }, [loadActivities, entityFilter])

  const handleLoadMore = async () => {
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const nextOffset = offset + limit
      const result = await getGlobalTimeline(
        entityFilter === "ALL" ? {} : { entityType: entityFilter },
        limit,
        nextOffset
      )
      setLogs((prev) => [...prev, ...result.logs])
      setOffset(nextOffset)
      setHasMore(result.hasMore)
    } catch (error) {
      console.error("Failed to load more activities:", error)
      toast.error("Failed to load more activities")
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading activity timeline...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Activity Timeline</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track all important actions across the platform
        </p>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
          <p className="text-muted-foreground">Failed to load activities.</p>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => loadActivities(entityFilter)}
          >
            Retry
          </Button>
        </div>
      ) : (
        <ActivityTimeline
          logs={logs}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          entityTypes={ENTITY_TYPES}
          entityFilter={entityFilter}
          onEntityFilterChange={setEntityFilter}
        />
      )}
    </div>
  )
}
