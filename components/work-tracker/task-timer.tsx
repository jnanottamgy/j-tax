"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowRightLeft, Loader2, Play, Square, Timer } from "lucide-react"
import { toast } from "sonner"

import {
  getMyRunningTimer,
  getTaskTimeSummary,
  startTimer,
  stopTimer,
  type RunningTimer,
  type TaskTimeSummary,
} from "@/app/actions/time-entries"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { minutesToHhMm, secondsToClock } from "@/lib/time/format"
import { cn } from "@/lib/utils"

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Per-task timer widget for the task detail drawer.
 * Self-fetches the task's time summary and the viewer's running timer.
 */
export function TaskTimer({ taskId }: { taskId: string }) {
  const [summary, setSummary] = useState<TaskTimeSummary | null>(null)
  const [running, setRunning] = useState<RunningTimer | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        getTaskTimeSummary(taskId),
        getMyRunningTimer(),
      ])
      setSummary(s)
      setRunning(r)
    } catch {
      toast.error("Failed to load time tracking data")
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  const runningHere = running !== null && running.taskId === taskId
  const runningElsewhere = running !== null && running.taskId !== taskId

  // Live tick while my timer runs on this task
  useEffect(() => {
    if (!runningHere) return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [runningHere])

  const elapsedSeconds = runningHere
    ? Math.max(0, (nowMs - new Date(running!.startedAt).getTime()) / 1000)
    : 0

  const handleStart = async () => {
    setPending(true)
    try {
      const result = await startTimer({ taskId })
      if (result.success) {
        toast.success(
          runningElsewhere ? "Timer switched to this task" : "Timer started"
        )
        await refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setPending(false)
    }
  }

  const handleStop = async () => {
    setPending(true)
    try {
      const result = await stopTimer()
      if (result.success) {
        toast.success(
          result.minutes !== undefined
            ? `Logged ${minutesToHhMm(result.minutes)}`
            : "Timer stopped"
        )
        await refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setPending(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Timer className="h-4 w-4" />
          Time Tracking
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  const total = summary?.totalMinutes ?? 0
  const estimated = summary?.estimatedMinutes ?? null
  const overBudget = estimated !== null && total > estimated

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Timer className="h-4 w-4" />
          Time Tracking
        </div>
        <div className="text-sm">
          <span className={cn("font-medium", overBudget && "text-destructive")}>
            {minutesToHhMm(total)} logged
          </span>
          {estimated !== null && (
            <span className="text-muted-foreground"> of {minutesToHhMm(estimated)}</span>
          )}
        </div>
      </div>

      {/* Timer controls */}
      <div className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.08] rounded-lg p-3">
        {runningHere ? (
          <>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="font-mono text-lg tabular-nums">
                {secondsToClock(elapsedSeconds)}
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStop}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Stop
            </Button>
          </>
        ) : runningElsewhere ? (
          <>
            <div className="min-w-0 text-xs text-muted-foreground">
              Timer running on{" "}
              <span className="font-medium text-foreground">
                {running?.taskTitle ?? running?.clientName ?? "another task"}
              </span>
            </div>
            <Button size="sm" onClick={handleStart} disabled={pending}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-3.5 w-3.5" />
              )}
              Switch timer here
            </Button>
          </>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              No timer running
            </div>
            <Button size="sm" onClick={handleStart} disabled={pending}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Start timer
            </Button>
          </>
        )}
      </div>

      {/* Last 3 entries */}
      {summary && summary.recentEntries.length > 0 && (
        <div className="space-y-1.5">
          {summary.recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate text-muted-foreground">
                <span className="font-medium text-foreground">
                  {entry.employeeName}
                </span>{" "}
                · {formatEntryDate(entry.startedAt)}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {entry.running ? "running" : minutesToHhMm(entry.minutes)}
              </span>
            </div>
          ))}
        </div>
      )}
      {summary && summary.recentEntries.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No time logged on this task yet
        </div>
      )}
    </div>
  )
}
