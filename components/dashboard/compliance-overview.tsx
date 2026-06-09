"use client"

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { SectionHeading } from "@/components/ui/section-heading"
import { cn } from "@/lib/utils"

interface ComplianceEvent {
  id: string
  title: string
  type: string
  dueDate: Date
  status: string
}

const statusConfig = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    className: "text-amber-400",
    bar: "bg-amber-500",
  },
  OVERDUE: {
    label: "Overdue",
    icon: AlertTriangle,
    className: "text-red-400",
    bar: "bg-red-500",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-emerald-400",
    bar: "bg-emerald-500",
  },
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ComplianceOverview({
  events,
  total,
  completed,
}: {
  events: ComplianceEvent[]
  total: number
  completed: number
}) {
  return (
    <GlassCard className="flex h-full flex-col p-6" hover={false}>
      <SectionHeading
        title="Compliance Overview"
        description="Upcoming statutory deadlines"
        action={
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {completed}/{total}
            </p>
            <p className="text-[11px] text-muted-foreground/80">events completed</p>
          </div>
        }
      />

      {events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="text-center">
            <CheckCircle2 className="size-8 mx-auto text-emerald-400 mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => {
            const config =
              statusConfig[event.status as keyof typeof statusConfig] ??
              statusConfig.PENDING
            const StatusIcon = config.icon

            return (
              <li key={event.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusIcon
                      className={cn("size-3.5 shrink-0", config.className)}
                    />
                    <span className="truncate font-medium">{event.title}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    Due {formatDate(event.dueDate)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        config.bar
                      )}
                      style={{
                        width:
                          event.status === "COMPLETED"
                            ? "100%"
                            : event.status === "OVERDUE"
                            ? "100%"
                            : "40%",
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground capitalize">
                    {config.label}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
