"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Item = { employeeId: string; name: string; department: string | null; actionCount: number }

export function TeamComparisonChart({ data }: { data: Item[] }) {
  const top10 = data.slice(0, 10)
  const max = Math.max(...top10.map((d) => d.actionCount), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Team Activity Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        {top10.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No activity data.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={90}
                tickFormatter={(v: string) => v.split(" ")[0]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as Item
                  return (
                    <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl">
                      <p className="font-medium">{d.name}</p>
                      {d.department && <p className="text-muted-foreground">{d.department}</p>}
                      <p className="mt-1 font-semibold">{d.actionCount} actions</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="actionCount" radius={[0, 4, 4, 0]}>
                {top10.map((entry) => (
                  <Cell
                    key={entry.employeeId}
                    fill={`oklch(0.7 0.16 265 / ${Math.max(0.3, entry.actionCount / max)})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
