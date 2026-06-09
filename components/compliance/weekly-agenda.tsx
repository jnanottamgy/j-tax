"use client"

import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, differenceInDays } from "date-fns"
import { ChevronLeft, ChevronRight, Clock, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  description?: string | null
}

interface WeeklyAgendaProps {
  events: ComplianceEvent[]
  currentDate: Date
  onDateChange: (date: Date) => void
  onEventClick?: (eventId: string) => void
}

export function WeeklyAgenda({
  events,
  currentDate,
  onDateChange,
  onEventClick,
}: WeeklyAgendaProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(new Date(event.dueDate), day))
  }

  const getEventStatus = (event: ComplianceEvent) => {
    if (event.status === "COMPLETED") return "completed"
    if (event.status === "CANCELLED") return "cancelled"
    if (event.status === "OVERDUE") return "overdue"
    
    const daysUntil = differenceInDays(new Date(event.dueDate), new Date())
    if (daysUntil < 0) return "overdue"
    if (daysUntil <= 3) return "due-soon"
    return "upcoming"
  }

  const handlePreviousWeek = () => {
    onDateChange(subWeeks(currentDate, 1))
  }

  const handleNextWeek = () => {
    onDateChange(addWeeks(currentDate, 1))
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  return (
    <Card className="bg-white/[0.02] border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handlePreviousWeek}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleNextWeek}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-8"
            >
              Today
            </Button>
          </div>
        </div>
      </div>

      {/* Agenda */}
      <div className="divide-y divide-white/[0.08]">
        {weekDays.map((day) => {
          const dayEvents = getEventsForDay(day)
          const isDayToday = isToday(day)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "p-4 transition-colors",
                isDayToday && "bg-primary/5"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Date Column */}
                <div className="w-20 flex-shrink-0">
                  <div className={cn(
                    "text-2xl font-bold",
                    isDayToday && "text-primary"
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className={cn(
                    "text-sm text-muted-foreground",
                    isDayToday && "text-primary/70"
                  )}>
                    {format(day, "EEE")}
                  </div>
                </div>

                {/* Events Column */}
                <div className="flex-1 space-y-2">
                  {dayEvents.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      No events scheduled
                    </div>
                  ) : (
                    dayEvents.map((event) => {
                      const eventStatus = getEventStatus(event)
                      
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "bg-white/[0.02] border border-white/[0.08] rounded-lg p-3 cursor-pointer transition-all hover:bg-white/[0.04] hover:border-white/[0.12]",
                            eventStatus === "completed" && "opacity-50",
                            eventStatus === "overdue" && "border-red-500/30 bg-red-500/5"
                          )}
                          onClick={() => onEventClick?.(event.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <ComplianceTypeBadge type={event.type} />
                                {eventStatus === "overdue" && (
                                  <div className="flex items-center gap-1 text-xs text-red-400">
                                    <AlertCircle className="h-3 w-3" />
                                    Overdue
                                  </div>
                                )}
                                {eventStatus === "due-soon" && (
                                  <div className="flex items-center gap-1 text-xs text-orange-400">
                                    <Clock className="h-3 w-3" />
                                    Due Soon
                                  </div>
                                )}
                              </div>
                              <h4 className="font-medium text-sm mb-1">{event.title}</h4>
                              {event.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                              {event.client && (
                                <div className="text-xs text-muted-foreground mt-2">
                                  {event.client.name}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground flex-shrink-0">
                              {format(new Date(event.dueDate), "MMM d, yyyy")}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
