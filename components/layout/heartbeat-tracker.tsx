"use client"

/**
 * Tells the server the person is still here.
 *
 * Worked minutes are accumulated from these beats, so this is not telemetry —
 * it is the timesheet. Two rules follow from that.
 *
 * It only beats when the tab is visible. It used to fire on a bare interval, so
 * a laptop left open overnight reported its owner online until morning; with
 * minutes now counted from beats, that would have billed the night as work.
 *
 * It beats once on becoming visible again, so coming back from another tab is
 * registered immediately rather than up to five minutes later. The server caps
 * what a single beat can credit, so an early beat cannot inflate anything.
 */

import { useEffect } from "react"

import { recordHeartbeat } from "@/app/actions/workforce"
import { HEARTBEAT_INTERVAL_MINUTES } from "@/lib/workforce/presence"

const INTERVAL_MS = HEARTBEAT_INTERVAL_MINUTES * 60 * 1000

export function HeartbeatTracker() {
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") return
      void recordHeartbeat().catch(() => {
        // A dropped beat costs at most one interval and the next one carries
        // the gap. Never worth surfacing to whoever is working.
      })
    }

    beat()
    const id = setInterval(beat, INTERVAL_MS)

    // Coming back to the tab counts immediately; leaving it simply stops the
    // beats, which is what makes a closed laptop stop earning minutes.
    document.addEventListener("visibilitychange", beat)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", beat)
    }
  }, [])

  return null
}
