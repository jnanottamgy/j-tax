"use client"

import { format, differenceInDays, isPast, isToday } from "date-fns"
import { Clock, AlertTriangle, CheckCircle2, Calendar } from "lucide-react"

import { Card } from "@/components/ui/card"
import { ComplianceTypeBadge } from "./compliance-type-badge"
import { cn } from "@/lib/utils"

type ComplianceType = "GSTR_1" | "GSTR_3B" | "TDS" | "ROC" | "ITR" | "PF_ESIC" | "CUSTOM"

interface ComplianceEvent {
  id: string
  type: ComplianceType
  title: string
  dueDate: Date
  status: "PENDING" | "COMPLETED" | "OVERDUE" | "CANCELLED"
  client?: {
    id: string
    name: string
  }
}

interface UpcomingDeadlinesProps {
  events: ComplianceEvent[]
  onEventClick?: (eventId: string) => void
  days?: number
}

export function UpcomingDeadlines({
  events,
  onEventClick,
  days = 30,
}: UpcomingDeadlinesProps) {
  const getEventUrgency = (event: ComplianceEvent) => {
    if (event.status === "COMPLETED") return "completed"
    if (event.status === "CANCELLED") return "cancelled"
    
    const eventDate = new Date(event.dueDate)
    const daysUntil = differenceInDays(eventDate, new Date())
    
    if (isPast(eventDate) && !isToday(eventDate)) return "overdue"
    if (isToday(eventDate)) return "today"
    if (daysUntil <= 3) return "urgent"
    if (daysUntil <= 7) return "soon"
    return "upcoming"
  }

  const urgencyConfig = {
    overdue: {
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      label: "Overdue",
    },
    today: {
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      label: "Today",
    },
    urgent: {
      icon: AlertTriangle,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
      label: "Due Soon",
    },
    soon: {
      icon: Clock,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/20",
      label: "This Week",
    },
    upcoming: {
      icon: Calendar,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      label: "Upcoming",
    },
    completed: {
      icon: CheckCircle2,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      label: "Completed",
    },
    cancelled: {
      icon: null,
      color: "text-muted-foreground",
      bgColor: "bg-slate-500/10",
      borderColor: "border-slate-500/20",
      label: "Cancelled",
    },
  }

  const sortedEvents = [...events].sort((a, b) => {
    const urgencyOrder = { overdue: 0, today: 1, urgent: 2, soon: 3, upcoming: 4, completed: 5, cancelled: 6 }
    const aUrgency = getEventUrgency(a)
    const bUrgency = getEventUrgency(b)
    
    if (urgencyOrder[aUrgency] !== urgencyOrder[bUrgency]) {
      return urgencyOrder[aUrgency] - urgencyOrder[bUrgency]
    }
    
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  const groupedEvents = sortedEvents.reduce((acc, event) => {
    const urgency = getEventUrgency(event)
    if (!acc[urgency]) acc[urgency] = []
    acc[urgency].push(event)
    return acc
  }, {} as Record<string, ComplianceEvent[]>)

  return (
    <Card className="bg-white/[0.02] border-white/[0.08] overflow-hidden">
      <div className="p-4 border-b border-white/[0.08]">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Upcoming Deadlines
          <span className="text-sm text-muted-foreground font-normal">
            (Next {days} days)
          </span>
        </h3>
      </div>

      <div className="divide-y divide-white/[0.08] max-h-[600px] overflow-y-auto">
        {sortedEvents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No upcoming deadlines
          </div>
        ) : (
          sortedEvents.map((event) => {
            const urgency = getEventUrgency(event)
            const config = urgencyConfig[urgency]
            const Icon = config.icon
            const daysUntil = differenceInDays(new Date(event.dueDate), new Date())

            return (
              <div
                key={event.id}
                className={cn(
                  "p-4 cursor-pointer transition-all hover:bg-white/[0.04]",
                  config.bgColor
                )}
                onClick={() => onEventClick?.(event.id)}
              >
                <div className="flex items-start gap-3">
                  {Icon && (
                    <div className={cn("mt-0.5", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ComplianceTypeBadge type={event.type} />
                      <span className={cn("text-xs font-medium", config.color)}>
                        {config.label}
                      </span>
                    </div>
                    <h4 className="font-medium text-sm mb-1">{event.title}</h4>
                    {event.client && (
                      <div className="text-xs text-muted-foreground mb-2">
                        {event.client.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(event.dueDate), "MMM d, yyyy")}
                      {daysUntil >= 0 && (
                        <span className="text-muted-foreground/70">
                          ({daysUntil} days)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Summary */}
      {sortedEvents.length > 0 && (
        <div className="p-4 border-t border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">
                  {groupedEvents.overdue?.length || 0} Overdue
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">
                  {(groupedEvents.today?.length || 0) + (groupedEvents.urgent?.length || 0)} Urgent
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">
                  {groupedEvents.soon?.length || 0} This Week
                </span>
              </div>
            </div>
            <div className="text-muted-foreground">
              {sortedEvents.length} total
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
