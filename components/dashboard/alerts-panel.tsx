"use client"

import { motion } from "framer-motion"
import { AlertTriangle, Clock, DollarSign, FileText, X, CheckCircle2 } from "lucide-react"
import Link from "next/link"

import { GlassCard } from "@/components/dashboard/glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Alert {
  id: string
  type: "overdue" | "deadline" | "payment" | "document"
  title: string
  description: string
  priority: "high" | "medium" | "low"
  action?: {
    label: string
    href: string
  }
}

interface AlertsPanelProps {
  alerts: Alert[]
  onDismiss?: (id: string) => void
}

const alertConfig = {
  overdue: {
    icon: AlertTriangle,
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  deadline: {
    icon: Clock,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  payment: {
    icon: DollarSign,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  document: {
    icon: FileText,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
}

const priorityConfig = {
  high: "bg-red-500/10 text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
}

export function AlertsPanel({ alerts, onDismiss }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return (
      <GlassCard hover={false} className="p-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-muted-foreground">No alerts at this time</p>
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard hover={false} className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-semibold">Alerts</h3>
          <Badge variant="outline" className="ml-2">
            {alerts.length}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.slice(0, 5).map((alert, index) => {
          const config = alertConfig[alert.type]
          const Icon = config.icon
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border",
                config.borderColor,
                config.bgColor
              )}
            >
              <div className={cn("p-2 rounded-lg", config.bgColor)}>
                <Icon className={cn("h-4 w-4", config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{alert.title}</p>
                  {onDismiss && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 -mt-1 -mr-1"
                      onClick={() => onDismiss(alert.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                {alert.action && (
                  <Link href={alert.action.href}>
                    <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs">
                      {alert.action.label} →
                    </Button>
                  </Link>
                )}
              </div>
              <Badge variant="outline" className={cn("text-[10px] h-5", priorityConfig[alert.priority])}>
                {alert.priority}
              </Badge>
            </motion.div>
          )
        })}
      </div>

      {alerts.length > 5 && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-xs text-muted-foreground text-center">
            +{alerts.length - 5} more alerts
          </p>
        </div>
      )}
    </GlassCard>
  )
}
