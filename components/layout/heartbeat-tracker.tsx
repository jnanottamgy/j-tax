"use client"

import { useEffect } from "react"
import { recordHeartbeat } from "@/app/actions/workforce"

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function HeartbeatTracker() {
  useEffect(() => {
    recordHeartbeat()

    const id = setInterval(() => {
      recordHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    return () => clearInterval(id)
  }, [])

  return null
}
