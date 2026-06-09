"use client"

import { AlertTriangle, Zap, Activity, Eye } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { WorkloadAlert } from "@/app/actions/workforce"

type Props = {
  alerts: WorkloadAlert[]
  onEmployeeClick: (id: string) => void
}

const ALERT_CONFIG = {
  OVERLOADED: { icon: Zap, color: "text-orange-500", bg: "bg-orange-500/8 border-orange-500/20" },
  UNDERUTILIZED: { icon: Activity, color: "text-blue-400", bg: "bg-blue-400/8 border-blue-400/20" },
  EXCESSIVE_OVERDUE: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/8 border-red-500/20" },
  NO_ACTIVITY: { icon: Eye, color: "text-yellow-500", bg: "bg-yellow-500/8 border-yellow-500/20" },
}

const SEVERITY_BADGE = {
  HIGH: "bg-red-500/15 text-red-500 border-red-500/20",
  MEDIUM: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  LOW: "bg-blue-500/15 text-blue-400 border-blue-500/20",
}

export function WorkloadAlertsPanel({ alerts, onEmployeeClick }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
        <AlertTriangle className="size-8 opacity-30" />
        <p>No workload alerts. Team is well-balanced.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const cfg = ALERT_CONFIG[alert.alertType]
        const Icon = cfg.icon

        return (
          <Card key={`${alert.employeeId}-${alert.alertType}-${i}`} className={`border ${cfg.bg}`}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-current/10`}>
                <Icon className={`size-4 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-sm truncate">{alert.employeeName}</p>
                  {alert.department && (
                    <span className="text-[11px] text-muted-foreground">· {alert.department}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[10px] ${SEVERITY_BADGE[alert.severity]}`}>
                  {alert.severity}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => onEmployeeClick(alert.employeeId)}
                >
                  View
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
