"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { GlassCard } from "@/components/dashboard/glass-card"
import { SectionHeading } from "@/components/ui/section-heading"

interface StatusCount {
  status: string
  _count: number
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  DATA_AWAITED: "Data Awaited",
  UNDER_REVIEW: "Under Review",
  FILED_DONE: "Filed",
  ON_HOLD: "On Hold",
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="surface-elevated rounded-xl px-3.5 py-2.5">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Tasks</span>
          <span className="font-medium tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function FilingChart({
  taskStatusCounts,
}: {
  taskStatusCounts: StatusCount[]
}) {
  const data = taskStatusCounts.map((s) => ({
    status: STATUS_LABELS[s.status] ?? s.status,
    count: s._count,
  }))

  return (
    <GlassCard hover={false} className="flex h-full flex-col p-6">
      <SectionHeading
        title="Tasks by Status"
        description="Current work tracker breakdown"
      />

      {data.length === 0 ? (
        <div className="flex h-[280px] items-center justify-center">
          <p className="text-sm text-muted-foreground">No tasks yet</p>
        </div>
      ) : (
        <div className="h-[280px] min-h-[280px] w-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(1 0 0 / 6%)"
                vertical={false}
              />
              <XAxis
                dataKey="status"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 9 }}
                dy={8}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
              <Bar
                dataKey="count"
                name="count"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  )
}
