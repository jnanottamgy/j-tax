"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2 } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { SectionHeading } from "@/components/ui/section-heading"
import { formatINRCompact } from "@/lib/india/format"
import {
  getRevenueSeries,
  type Granularity,
  type RevenuePoint,
} from "@/app/actions/dashboard-series"

const formatCurrency = formatINRCompact

function currentStartYear(): number {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
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
          <span className="capitalize text-muted-foreground">{entry.name}</span>
          <span className="font-medium tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Revenue trend driven by the dashboard header's FY + granularity selection
 * (read from the URL). Fetches its own series so the server dashboard page and
 * its cached fetchers don't need to change.
 */
export function RevenueTrendChart() {
  const searchParams = useSearchParams()
  const startYear = useMemo(() => {
    const fy = searchParams.get("fy")
    const m = fy?.match(/(\d{4})/)
    return m ? Number(m[1]) : currentStartYear()
  }, [searchParams])
  const granularity = (searchParams.get("g") as Granularity) || "monthly"

  const [data, setData] = useState<RevenuePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getRevenueSeries(startYear, granularity)
      .then((rows) => {
        if (!cancelled) setData(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [startYear, granularity])

  const fyLabel = `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
  const granLabel = granularity === "daily" ? "daily" : granularity === "yearly" ? "annual" : "monthly"

  return (
    <GlassCard hover={false} className="flex h-full flex-col p-6">
      <SectionHeading
        title="Billed vs Collected"
        description={`${granLabel} trend · ${fyLabel}`}
      />

      <div className="h-[280px] min-h-[280px] w-full min-w-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No invoices in {fyLabel}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 11 }}
                dy={8}
                interval={granularity === "daily" ? "preserveStartEnd" : 0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 11 }}
                tickFormatter={(v) => formatCurrency(v)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="billed" name="Billed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="collected" name="Collected" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </GlassCard>
  )
}
