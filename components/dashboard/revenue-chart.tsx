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

function formatCurrency(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString("en-IN")}`
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string; fill: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="surface-elevated rounded-xl px-3.5 py-2.5">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
          <span className="capitalize text-muted-foreground">{entry.name}</span>
          <span className="font-medium tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function RevenueChart({
  collected,
  outstanding,
}: {
  collected: number
  outstanding: number
}) {
  // Single-bar summary — a full monthly breakdown requires a separate query
  const data = [
    { label: "Collected", value: collected },
    { label: "Outstanding", value: outstanding },
  ]

  return (
    <GlassCard hover={false} className="flex h-full flex-col p-6">
      <SectionHeading
        title="Collections vs Outstanding"
        description="Lifetime totals across all invoices"
      />

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
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 11 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 11 }}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
            <Bar
              dataKey="value"
              name="amount"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}
