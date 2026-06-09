"use client"

import { motion } from "framer-motion"
import {
  ArrowDownRight,
  ArrowUpRight,
  Users,
  Receipt,
  Shield,
  Wallet,
} from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { cn } from "@/lib/utils"

interface KpiData {
  totalClients: number
  activeClients: number
  totalOutstanding: number
  totalCollected: number
  totalOverdue: number
  overdueCount: number
  complianceScore: number
  pendingComplianceCount: number
}

const accentGradients = [
  "from-primary/20 to-primary/5",
  "from-sky-500/20 to-sky-500/5",
  "from-emerald-500/20 to-emerald-500/5",
  "from-violet-500/20 to-violet-500/5",
]

function formatCurrency(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString("en-IN")}`
}

export function KpiCards({ data }: { data: KpiData }) {
  const metrics = [
    {
      title: "Active Clients",
      value: `${data.activeClients}`,
      sub: `${data.totalClients} total`,
      trend: "up" as const,
      icon: Users,
      positive: true,
    },
    {
      title: "Outstanding Balance",
      value: formatCurrency(data.totalOutstanding),
      sub: `${data.overdueCount} overdue`,
      trend: data.totalOverdue > 0 ? ("up" as const) : ("down" as const),
      icon: Receipt,
      positive: data.totalOverdue === 0,
    },
    {
      title: "Compliance Score",
      value: `${data.complianceScore}%`,
      sub: `${data.pendingComplianceCount} pending`,
      trend: data.complianceScore >= 80 ? ("up" as const) : ("down" as const),
      icon: Shield,
      positive: data.complianceScore >= 80,
    },
    {
      title: "Total Collected",
      value: formatCurrency(data.totalCollected),
      sub: "lifetime",
      trend: "up" as const,
      icon: Wallet,
      positive: true,
    },
  ]

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        return (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: index * 0.07,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <GlassCard glow className="group p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3.5">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {metric.title}
                  </p>
                  <p className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
                    {metric.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-white/[0.08] transition-all duration-500 group-hover:scale-105 group-hover:ring-primary/25",
                    accentGradients[index % accentGradients.length]
                  )}
                >
                  <Icon className="size-[18px] text-primary" />
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2.5 border-t border-white/[0.05] pt-4 text-xs">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-medium",
                    metric.positive
                      ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/15"
                      : "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/15"
                  )}
                >
                  {metric.trend === "up" ? (
                    <ArrowUpRight className="size-3" />
                  ) : (
                    <ArrowDownRight className="size-3" />
                  )}
                  {metric.sub}
                </span>
              </div>
            </GlassCard>
          </motion.div>
        )
      })}
    </div>
  )
}
