"use client"

import { Users } from "lucide-react"

import type { TeamTimesheetRow } from "@/app/actions/time-entries"
import { GlassCard } from "@/components/dashboard/glass-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { minutesToHhMm } from "@/lib/time/format"
import { cn } from "@/lib/utils"

/** A standard 40-hour week, in minutes, for the utilization denominator. */
const WEEK_CAPACITY_MINUTES = 40 * 60

function utilizationPercent(billableMinutes: number): number {
  return Math.min(100, Math.round((billableMinutes / WEEK_CAPACITY_MINUTES) * 100))
}

type TeamTimesheetTableProps = {
  rows: TeamTimesheetRow[] | null
  loading: boolean
}

export function TeamTimesheetTable({ rows, loading }: TeamTimesheetTableProps) {
  if (loading) {
    return (
      <GlassCard hover={false} className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </GlassCard>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No team data"
        description="No active employees found for this week."
      />
    )
  }

  return (
    <GlassCard hover={false} className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Employee</th>
            <th className="px-4 py-3 font-medium text-right">Entries</th>
            <th className="px-4 py-3 font-medium text-right">Total</th>
            <th className="px-4 py-3 font-medium text-right">Billable</th>
            <th className="px-4 py-3 font-medium">Utilization</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const utilization = utilizationPercent(row.billableMinutes)
            return (
              <tr
                key={row.employeeId}
                className="border-b border-white/[0.05] last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{row.employeeName}</div>
                  {row.department && (
                    <div className="text-xs text-muted-foreground">
                      {row.department}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {row.entryCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {minutesToHhMm(row.totalMinutes)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {minutesToHhMm(row.billableMinutes)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          utilization >= 80
                            ? "bg-emerald-500"
                            : utilization >= 50
                              ? "bg-primary"
                              : "bg-amber-500"
                        )}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {utilization}%
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </GlassCard>
  )
}
