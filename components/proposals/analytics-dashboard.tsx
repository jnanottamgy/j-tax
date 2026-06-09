"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { getProposalAnalytics } from "@/app/actions/proposals"

type Analytics = Awaited<ReturnType<typeof getProposalAnalytics>>

const LEAD_COLORS: Record<string, string> = {
  NEW_LEAD: "#3b82f6", CONTACTED: "#f59e0b", PROPOSAL_SENT: "#8b5cf6",
  NEGOTIATION: "#f97316", WON: "#10b981", LOST: "#ef4444",
}
const LEAD_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead", CONTACTED: "Contacted", PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
}
const QUOT_COLORS: Record<string, string> = {
  DRAFT: "#6b7280", PENDING_APPROVAL: "#f59e0b", APPROVED: "#3b82f6",
  SENT: "#8b5cf6", VIEWED: "#06b6d4", ACCEPTED: "#10b981", REJECTED: "#ef4444", EXPIRED: "#9ca3af",
}

export function AnalyticsDashboard({ analytics }: { analytics: Analytics }) {
  const leadData = Object.entries(analytics.leadsByStatus).map(([status, count]) => ({
    name: LEAD_LABELS[status] ?? status,
    value: count as number,
    color: LEAD_COLORS[status] ?? "#6b7280",
  }))

  const quotData = Object.entries(analytics.quotationsByStatus).map(([status, count]) => ({
    name: status.replace("_", " "),
    count: count as number,
    fill: QUOT_COLORS[status] ?? "#6b7280",
  }))

  const kpis = [
    { label: "Total Leads", value: analytics.totalLeads },
    { label: "Total Quotations", value: analytics.totalQuotations },
    { label: "Acceptance Rate", value: `${analytics.acceptanceRate}%` },
    { label: "Lead Conversion", value: `${analytics.conversionRate}%` },
    { label: "Avg Deal Size", value: analytics.avgDealSize > 0 ? `₹${Math.round(analytics.avgDealSize / 1000)}k` : "—" },
    { label: "Revenue Pipeline", value: analytics.revenuePipeline > 0 ? `₹${(analytics.revenuePipeline / 100000).toFixed(1)}L` : "₹0" },
    { label: "Won Revenue", value: analytics.wonRevenue > 0 ? `₹${(analytics.wonRevenue / 100000).toFixed(1)}L` : "₹0" },
  ]

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">{k.label}</p>
              <p className="text-lg font-semibold mt-0.5 tabular-nums">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lead Pipeline Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Lead Pipeline Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {leadData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No lead data.</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={leadData} dataKey="value" innerRadius={45} outerRadius={72} paddingAngle={3}>
                      {leadData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl">
                            <p className="font-medium">{payload[0].name}</p>
                            <p className="text-primary">{payload[0].value} leads</p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {leadData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-medium ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotation Status Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Quotation Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {quotData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No quotation data.</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={quotData} margin={{ left: 0, right: 8 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl">
                          <p className="font-medium capitalize">{payload[0].payload.name}</p>
                          <p className="text-primary">{payload[0].value} quotations</p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {quotData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
