"use client"

/**
 * Who is over-committed, and when.
 *
 * The app could say how many tasks someone held and never how many working days
 * they had left to do them in — which is the only form of the question that has
 * an answer. September and March are pre-set because those are the two months
 * an Indian practice actually plans around: tax audit, and year-end.
 */

import { useEffect, useState } from "react"
import { AlertTriangle, CalendarClock } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { Button } from "@/components/ui/button"
import { getCapacity, type CapacityReport } from "@/app/actions/leave"
import { cn } from "@/lib/utils"

type Window = "next30" | "september" | "march"

const WINDOW_LABELS: Record<Window, string> = {
  next30: "Next 30 days",
  september: "September peak",
  march: "March peak",
}

const LOAD_STYLE: Record<string, string> = {
  OVER: "text-red-400",
  TIGHT: "text-amber-400",
  BUSY: "text-sky-400",
  CLEAR: "text-muted-foreground",
}

const LOAD_LABEL: Record<string, string> = {
  OVER: "Over capacity",
  TIGHT: "Tight",
  BUSY: "Busy",
  CLEAR: "Clear",
}

export function CapacityPanel() {
  const [window, setWindow] = useState<Window>("next30")
  const [report, setReport] = useState<CapacityReport | null>(null)

  useEffect(() => {
    let cancelled = false
    setReport(null)
    getCapacity(window === "next30" ? undefined : { peak: window })
      .then((r) => { if (!cancelled) setReport(r) })
      .catch(() => { if (!cancelled) setReport(null) })
    return () => { cancelled = true }
  }, [window])

  const strained = report?.rows.filter((r) => r.load === "OVER" || r.load === "TIGHT") ?? []

  return (
    <GlassCard hover={false} className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-primary" aria-hidden />
            Capacity
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Open work against working days actually available, after leave.
          </p>
        </div>
        <div className="flex rounded-xl border border-white/[0.07] p-0.5">
          {(Object.keys(WINDOW_LABELS) as Window[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                window === w ? "bg-white/[0.08] text-foreground" : "text-muted-foreground"
              )}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
      </div>

      {strained.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {strained.length} {strained.length === 1 ? "person is" : "people are"} carrying
              more than {report?.windowLabel.toLowerCase()} can hold.
            </span>{" "}
            Reassigning now is cheaper than explaining a missed deadline later.
          </p>
        </div>
      )}

      {!report ? (
        <p className="mt-4 text-sm text-muted-foreground">Working it out…</p>
      ) : report.rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No active employees.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-white/[0.05]">
          {report.rows.map((r) => (
            <li key={r.employeeId} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.employeeName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.warning ?? `${r.dueInWindow} due · ${r.workingDays} working days`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("text-sm font-medium tabular-nums", LOAD_STYLE[r.load])}>
                  {LOAD_LABEL[r.load]}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {Number.isFinite(r.tasksPerDay) ? `${r.tasksPerDay}/day` : "no days left"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  )
}
