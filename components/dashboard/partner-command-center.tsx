"use client"

import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  DollarSign,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PartnerCommandCenterProps {
  stats: {
    totalRevenue: number
    totalOutstanding: number
    totalOverdue: number
    collectionRate: number
    pendingApprovals: number
    activeEmployees: number
    highRiskClients: number
    complianceScore: number
  }
  pendingApprovals: Array<{
    id: string
    clientName: string
    amount: number
    type: string
  }>
  highRiskClients: Array<{
    id: string
    name: string
    riskReason: string
  }>
}

function MetricTile({
  label,
  value,
  subtext,
  icon: Icon,
  color,
  href,
  trend,
}: {
  label: string
  value: string | number
  subtext?: string
  icon: React.ElementType
  color: string
  href?: string
  trend?: "up" | "down" | "neutral"
}) {
  const inner = (
    <div className="flex items-center gap-3">
      <div className={`flex size-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-xl font-bold truncate">{value}</p>
          {trend && (
            <span className={trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : ""}>
              {trend === "up" ? <TrendingUp className="size-3.5" /> : trend === "down" ? <TrendingDown className="size-3.5" /> : null}
            </span>
          )}
        </div>
        {subtext && <p className="text-[11px] text-muted-foreground truncate">{subtext}</p>}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all hover:border-white/[0.1] hover:bg-white/[0.04]"
      >
        {inner}
      </Link>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      {inner}
    </div>
  )
}

export function PartnerCommandCenter({
  stats,
  pendingApprovals,
  highRiskClients,
}: PartnerCommandCenterProps) {
  const formatCurrency = (n: number) =>
    n >= 100000
      ? `₹${(n / 100000).toFixed(1)}L`
      : `₹${n.toLocaleString("en-IN")}`

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Zap className="size-4 text-primary" />
          Partner Command Center
          <Badge className="ml-auto bg-primary/15 text-primary text-[10px]">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Revenue & Collection row */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            subtext={`${stats.collectionRate}% collected`}
            icon={DollarSign}
            color="bg-green-500/10 text-green-400"
            href="/payments"
            trend="up"
          />
          <MetricTile
            label="Outstanding"
            value={formatCurrency(stats.totalOutstanding)}
            subtext="across all clients"
            icon={TrendingDown}
            color="bg-amber-500/10 text-amber-400"
            href="/payments"
          />
          <MetricTile
            label="Overdue Amount"
            value={formatCurrency(stats.totalOverdue)}
            subtext="requires follow-up"
            icon={AlertTriangle}
            color="bg-red-500/10 text-red-400"
            href="/payments"
            trend={stats.totalOverdue > 50000 ? "down" : "neutral"}
          />
          <MetricTile
            label="Compliance Score"
            value={`${stats.complianceScore}%`}
            subtext="portfolio health"
            icon={Shield}
            color="bg-blue-500/10 text-blue-400"
            href="/compliance"
            trend={stats.complianceScore >= 80 ? "up" : "down"}
          />
        </div>

        {/* Operations row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile
            label="Pending Approvals"
            value={stats.pendingApprovals}
            subtext="quotations awaiting review"
            icon={CheckSquare}
            color={stats.pendingApprovals > 0 ? "bg-amber-500/10 text-amber-400" : "bg-white/[0.05] text-muted-foreground"}
            href="/proposals"
          />
          <MetricTile
            label="Active Employees"
            value={stats.activeEmployees}
            subtext="view workforce intelligence"
            icon={Users}
            color="bg-primary/10 text-primary"
            href="/workforce"
          />
          <MetricTile
            label="High Risk Clients"
            value={stats.highRiskClients}
            subtext="overdue tasks or compliance"
            icon={AlertTriangle}
            color={stats.highRiskClients > 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}
            href="/clients"
            trend={stats.highRiskClients > 3 ? "down" : "neutral"}
          />
        </div>

        {/* Pending approvals list */}
        {pendingApprovals.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">
                Pending Approval
              </p>
              <Link
                href="/proposals"
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-1">
              {pendingApprovals.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  href={`/proposals/quotations/${item.id}`}
                  className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 transition-all hover:border-white/[0.08] hover:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-[13px] font-medium">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold">{formatCurrency(item.amount)}</p>
                    <Badge className="bg-amber-400/15 text-amber-400 text-[10px]">Review</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* High-risk clients */}
        {highRiskClients.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest">
                High Risk Clients
              </p>
              <Link
                href="/clients"
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-1">
              {highRiskClients.slice(0, 3).map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center justify-between rounded-lg border border-red-500/[0.08] bg-red-500/[0.02] px-3 py-2 transition-all hover:border-red-500/[0.15] hover:bg-red-500/[0.04]"
                >
                  <p className="text-[13px] font-medium">{client.name}</p>
                  <Badge className="bg-red-400/10 text-red-400 text-[10px]">
                    {client.riskReason}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick links to analytics */}
        <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
          {[
            { label: "Workforce", href: "/workforce", icon: BarChart3 },
            { label: "Reports", href: "/reports", icon: Activity },
            { label: "Audit Logs", href: "/activity", icon: Shield },
            { label: "Proposals", href: "/proposals", icon: CheckSquare },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px] text-muted-foreground transition-all hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-foreground"
            >
              <link.icon className="size-3.5 shrink-0" />
              <span className="truncate">{link.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
