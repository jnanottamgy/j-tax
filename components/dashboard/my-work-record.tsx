"use client"

/**
 * What the firm has recorded about me.
 *
 * The workforce module is Partner and Manager only, so the people being
 * measured could not see any of it. Being judged on numbers you cannot check is
 * the fastest way to stop trusting a tool — and while hours were derived from
 * login and logout, nobody was in a position to notice that a day spent working
 * had been recorded as zero.
 *
 * Deliberately plain and unranked. This is somebody's own record, not a
 * leaderboard.
 */

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { getMyWorkRecord, type MyWorkRecord } from "@/app/actions/workforce"

const hours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`

export function MyWorkRecordCard() {
  const [record, setRecord] = useState<MyWorkRecord | null | "none">(null)

  useEffect(() => {
    let cancelled = false
    getMyWorkRecord()
      .then((r) => { if (!cancelled) setRecord(r ?? "none") })
      .catch(() => { if (!cancelled) setRecord("none") })
    return () => { cancelled = true }
  }, [])

  // "none" means this account has no employee record — a client-portal user or
  // an account never linked to staff. Nothing useful to show.
  if (record === null || record === "none") return null

  return (
    <GlassCard hover={false} className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-4 text-primary" aria-hidden />
          Your hours this month
        </h3>
        <span className="text-xs text-muted-foreground">
          {record.daysPresent} day{record.daysPresent === 1 ? "" : "s"} present
          {record.daysLate > 0 && `, ${record.daysLate} late`}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{hours(record.todayMinutes)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">This week</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{hours(record.weekMinutes)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">This month</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{hours(record.monthMinutes)}</p>
        </div>
      </div>

      {/* Time present and time booked to clients were two numbers that never
          met. The gap between them is the one worth knowing. */}
      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {hours(record.bookedThisMonth)} booked to clients
          </span>
          {record.utilisationPct != null && ` — ${record.utilisationPct}% of your time this month.`}
        </p>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground/70">
        Hours are counted while this app is open in front of you. Closing the tab stops the
        clock, so you do not need to sign out to be counted correctly.
      </p>
    </GlassCard>
  )
}
