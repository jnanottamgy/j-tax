"use client"

import { useCallback, useEffect, useState } from "react"
import { ActivityTimeline } from "@/components/activity/activity-timeline"
import { getGlobalTimeline } from "@/app/actions/activity"

export function ActivityTimelineClient() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(50)

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getGlobalTimeline({}, limit, 0)
      setLogs(result.logs)
      setHasMore(result.hasMore)
      setOffset(0)
    } catch (error) {
      console.error("Failed to load activities:", error)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const handleLoadMore = async () => {
    try {
      const result = await getGlobalTimeline({}, limit, offset + limit)
      setLogs((prev) => [...prev, ...result.logs])
      setOffset((prev) => prev + limit)
      setHasMore(result.hasMore)
    } catch (error) {
      console.error("Failed to load more activities:", error)
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

      <ActivityTimeline logs={logs} hasMore={hasMore} onLoadMore={handleLoadMore} />
    </div>
  )
}
