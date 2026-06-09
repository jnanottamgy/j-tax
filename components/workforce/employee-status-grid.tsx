"use client"

import { formatDistanceToNow } from "date-fns"
import { Clock, Wifi, WifiOff, Coffee, Plane } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { EmployeeStatusCard } from "@/app/actions/workforce"

type Props = {
  employees: EmployeeStatusCard[]
  onEmployeeClick: (id: string) => void
}

const STATUS_CONFIG = {
  ONLINE: { label: "Online", icon: Wifi, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  IDLE: { label: "Idle", icon: Coffee, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  OFFLINE: { label: "Offline", icon: WifiOff, color: "text-muted-foreground", bg: "bg-muted/30 border-white/5" },
  ON_LEAVE: { label: "On Leave", icon: Plane, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function EmployeeStatusGrid({ employees, onEmployeeClick }: Props) {
  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
        <Wifi className="size-8 opacity-30" />
        <p>No active employees found.</p>
      </div>
    )
  }

  const sorted = [...employees].sort((a, b) => {
    const order = { ONLINE: 0, IDLE: 1, ON_LEAVE: 2, OFFLINE: 3 }
    return order[a.status] - order[b.status]
  })

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((emp) => {
        const cfg = STATUS_CONFIG[emp.status]
        const Icon = cfg.icon
        const initials = emp.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

        return (
          <Card
            key={emp.id}
            className={`cursor-pointer border transition-all hover:shadow-md hover:scale-[1.01] ${cfg.bg}`}
            onClick={() => onEmployeeClick(emp.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-semibold text-primary ring-1 ring-primary/20">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.department ?? "—"}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 text-[10px] gap-1 ${cfg.color} border-current/30`}>
                  <Icon className="size-3" />
                  {cfg.label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-0.5">Today</p>
                  <p className="font-medium text-foreground">
                    {emp.todayActiveMinutes > 0 ? formatMinutes(emp.todayActiveMinutes) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-0.5">This Week</p>
                  <p className="font-medium text-foreground">
                    {emp.weekActiveMinutes > 0 ? formatMinutes(emp.weekActiveMinutes) : "—"}
                  </p>
                </div>
                {emp.loginAt && (
                  <div className="col-span-2 flex items-center gap-1 mt-1">
                    <Clock className="size-3" />
                    <span>
                      Logged in {formatDistanceToNow(new Date(emp.loginAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
                {!emp.loginAt && emp.lastActiveAt && (
                  <div className="col-span-2 flex items-center gap-1 mt-1">
                    <Clock className="size-3" />
                    <span>
                      Last seen {formatDistanceToNow(new Date(emp.lastActiveAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
