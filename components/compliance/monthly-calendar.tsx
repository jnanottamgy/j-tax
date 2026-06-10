"use client"

import { useState } from "react"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, differenceInDays } from "date-fns"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

interface MonthlyCalendarProps {
  events: ComplianceEvent[]
  currentDate: Date
  onDateChange: (date: Date) => void
  onEventClick?: (eventId: string) => void
  onAddEvent?: () => void
  canModify?: boolean
}

export function MonthlyCalendar({
  events,
  currentDate,
  onDateChange,
  onEventClick,
  onAddEvent,
  canModify = false,
}: MonthlyCalendarProps) {
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = new Date(monthStart)
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay())
  const calendarEnd = new Date(monthEnd)
  calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()))

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(new Date(event.dueDate), day))
  }

  const getDayStatus = (day: Date) => {
    const dayEvents = getEventsForDay(day)
    if (dayEvents.length === 0) return null
    
    const hasOverdue = dayEvents.some((e) => e.status === "OVERDUE" && new Date(e.dueDate) < new Date())
    const hasDueSoon = dayEvents.some((e) => {
      const daysUntil = differenceInDays(new Date(e.dueDate), new Date())
      return e.status === "PENDING" && daysUntil >= 0 && daysUntil <= 3
    })
    
    if (hasOverdue) return "overdue"
    if (hasDueSoon) return "due-soon"
    return "has-events"
  }

  const handlePreviousMonth = () => {
    onDateChange(subMonths(currentDate, 1))
  }

  const handleNextMonth = () => {
    onDateChange(addMonths(currentDate, 1))
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
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handlePreviousMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleNextMonth}
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
        {canModify && (
          <Button size="sm" className="btn-glow h-8 gap-1.5" onClick={() => onAddEvent?.()}>
            <Plus className="h-3.5" />
            Add Event
          </Button>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Week Days */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isDayToday = isToday(day)
            const dayEvents = getEventsForDay(day)
            const dayStatus = getDayStatus(day)

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[100px] p-1 rounded-lg border border-white/[0.04] transition-all duration-200",
                  isCurrentMonth ? "bg-white/[0.02]" : "bg-white/[0.01] opacity-40",
                  isDayToday && "bg-primary/5 border-primary/20",
                  hoveredDay && isSameDay(hoveredDay, day) && "bg-white/[0.04]",
                  "hover:bg-white/[0.04]"
                )}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <div className="flex items-start justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDayToday && "text-primary",
                      !isCurrentMonth && "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayStatus === "overdue" && (
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                  {dayStatus === "due-soon" && (
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                  )}
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs p-1 rounded truncate cursor-pointer transition-colors",
                        event.status === "COMPLETED" && "opacity-50",
                        event.status === "OVERDUE" && "bg-red-500/20 text-red-400",
                        event.status === "PENDING" && "bg-primary/10 text-primary/90 hover:bg-primary/20"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick?.(event.id)
                      }}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pb-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>Overdue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span>Due Soon</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Upcoming</span>
        </div>
      </div>
    </Card>
  )
}
