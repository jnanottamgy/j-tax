"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, TrendingUp, Users, FileText, BarChart3 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { getLeads, getQuotations, getProposalAnalytics } from "@/app/actions/proposals"
import { LeadPipelineTable } from "./lead-pipeline-table"
import { QuotationListTable } from "./quotation-list-table"
import { AnalyticsDashboard } from "./analytics-dashboard"
import { AddLeadDialog } from "./add-lead-dialog"

type Props = {
  initialLeads: Awaited<ReturnType<typeof getLeads>>
  initialQuotations: Awaited<ReturnType<typeof getQuotations>>
  initialAnalytics: Awaited<ReturnType<typeof getProposalAnalytics>>
}

export function ProposalsClient({ initialLeads, initialQuotations, initialAnalytics }: Props) {
  const [showAddLead, setShowAddLead] = useState(false)

  const pipeline = initialAnalytics.revenuePipeline
  const won = initialAnalytics.wonRevenue
  const sentCount = (initialAnalytics.quotationsByStatus["SENT"] ?? 0) + (initialAnalytics.quotationsByStatus["VIEWED"] ?? 0)

  return (
    <div className="mt-6 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Leads" value={initialAnalytics.totalLeads} sub="in pipeline" />
        <KpiCard
          label="Proposals Sent"
          value={sentCount}
          sub="awaiting response"
        />
        <KpiCard
          label="Acceptance Rate"
          value={`${initialAnalytics.acceptanceRate}%`}
          sub="of responded"
        />
        <KpiCard
          label="Revenue Pipeline"
          value={`₹${(pipeline / 100000).toFixed(1)}L`}
          sub={`₹${(won / 100000).toFixed(1)}L won`}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leads">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="leads">
              <Users className="size-3.5 mr-1.5" />
              Leads CRM
            </TabsTrigger>
            <TabsTrigger value="quotations">
              <FileText className="size-3.5 mr-1.5" />
              Quotations
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="size-3.5 mr-1.5" />
              Analytics
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowAddLead(true)}>
              <Plus className="size-3.5 mr-1" />
              Add Lead
            </Button>
            <Button size="sm" asChild>
              <Link href="/proposals/quotations/new">
                <Plus className="size-3.5 mr-1" />
                New Quotation
              </Link>
            </Button>
          </div>
        </div>

        <TabsContent value="leads" className="mt-0">
          <LeadPipelineTable initialLeads={initialLeads} />
        </TabsContent>

        <TabsContent value="quotations" className="mt-0">
          <QuotationListTable initialQuotations={initialQuotations} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <AnalyticsDashboard analytics={initialAnalytics} />
        </TabsContent>
      </Tabs>

      <AddLeadDialog open={showAddLead} onClose={() => setShowAddLead(false)} />
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  )
}
