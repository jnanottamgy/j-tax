"use client"

import { motion } from "framer-motion"
import { AlertTriangle, Clock, TrendingUp, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { cn } from "@/lib/utils"

interface ExecutiveSummaryProps {
  overdueTasks: number
  upcomingDeadlines: number
  outstandingInvoices: number
  pendingDocuments: number
  complianceScore: number
  workload: number
}

export function ExecutiveSummary({
  overdueTasks,
  upcomingDeadlines,
  outstandingInvoices,
  pendingDocuments,
  complianceScore,
  workload,
}: ExecutiveSummaryProps) {
  const hasAlerts = overdueTasks > 0 || upcomingDeadlines < 7 || outstandingInvoices > 0

  const metrics = [
    {
      label: "Overdue Tasks",
      value: overdueTasks,
      icon: AlertTriangle,
      color: overdueTasks > 0 ? "text-red-400" : "text-emerald-400",
      bgColor: overdueTasks > 0 ? "bg-red-500/10" : "bg-emerald-500/10",
      trend: overdueTasks > 0 ? "up" : "down",
    },
    {
      label: "Deadlines This Week",
      value: upcomingDeadlines,
      icon: Clock,
      color: upcomingDeadlines > 3 ? "text-amber-400" : "text-blue-400",
      bgColor: upcomingDeadlines > 3 ? "bg-amber-500/10" : "bg-blue-500/10",
      trend: "neutral",
    },
    {
      label: "Outstanding Invoices",
      value: outstandingInvoices,
      icon: TrendingUp,
      color: outstandingInvoices > 0 ? "text-orange-400" : "text-emerald-400",
      bgColor: outstandingInvoices > 0 ? "bg-orange-500/10" : "bg-emerald-500/10",
      trend: outstandingInvoices > 0 ? "up" : "down",
    },
    {
      label: "Pending Documents",
      value: pendingDocuments,
      icon: CheckCircle2,
      color: pendingDocuments > 0 ? "text-purple-400" : "text-emerald-400",
      bgColor: pendingDocuments > 0 ? "bg-purple-500/10" : "bg-emerald-500/10",
      trend: "neutral",
    },
  ]

  return (
    <GlassCard glow className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Executive Summary</h3>
          <p className="text-sm text-muted-foreground mt-1">Key metrics requiring attention</p>
        </div>
        {hasAlerts && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Action Required</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-1.5 rounded-lg", metric.bgColor)}>
                  <Icon className={cn("h-4 w-4", metric.color)} />
                </div>
                <span className="text-xs text-muted-foreground">{metric.label}</span>
              </div>
              <p className="text-2xl font-semibold">{metric.value}</p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Compliance Score</span>
            <span className="text-2xl font-semibold">{complianceScore}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                complianceScore >= 80 ? "bg-emerald-500" : complianceScore >= 60 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${complianceScore}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {complianceScore >= 80 ? "Excellent compliance posture" : complianceScore >= 60 ? "Needs attention" : "Critical compliance gaps"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Team Workload</span>
            <span className="text-2xl font-semibold">{workload}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                workload <= 70 ? "bg-emerald-500" : workload <= 85 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${workload}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {workload <= 70 ? "Healthy capacity" : workload <= 85 ? "Near capacity" : "Overloaded"}
          </p>
        </div>
      </div>
    </GlassCard>
  )
}
