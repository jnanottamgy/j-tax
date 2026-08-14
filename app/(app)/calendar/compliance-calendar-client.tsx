"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calendar as CalendarIcon, List, Plus, Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MonthlyCalendar } from "@/components/compliance/monthly-calendar"
import { WeeklyAgenda } from "@/components/compliance/weekly-agenda"
import { UpcomingDeadlines } from "@/components/compliance/upcoming-deadlines"
import { ComplianceEventModal } from "@/components/compliance/compliance-event-modal"
import { AddComplianceEventDialog } from "@/components/compliance/add-compliance-event-dialog"
import {
  getComplianceEvents,
  getUpcomingDeadlines,
  deleteComplianceEvent,
} from "@/app/actions/compliance"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type ViewMode = "monthly" | "weekly"

/**
 * Statutory dates and firm-set dates were two separate pages, two nav entries
 * and two mental models — and one table underneath, split by a boolean. Nobody
 * plans a month in two calendars: a GST deadline and the internal review a
 * manager set for three days earlier are the same week's work, and seeing them
 * apart is how one gets scheduled on top of the other.
 *
 * One calendar now, with a filter. "All" is the default because that is the
 * question being asked when someone opens a calendar.
 */
type SourceFilter = "all" | "statutory" | "firm"

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "Everything",
  statutory: "Statutory",
  firm: "Firm-set",
}

export function ComplianceCalendarClient({
  initialSource = "all",
}: {
  /** Deep links from the old two-calendar routes land on the right filter. */
  initialSource?: SourceFilter
}) {
  const [source, setSource] = useState<SourceFilter>(initialSource)
  // undefined asks the action for both kinds; the split is a data filter, not
  // a permission boundary — employees are already scoped to their own clients.
  const isStatutory = source === "all" ? undefined : source === "statutory"
  const _router = useRouter()
  const [viewMode, setViewMode] = useState<ViewMode>("monthly")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<any[]>([])
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const month = currentDate.getMonth() + 1
      const year = currentDate.getFullYear()
      const [eventsData, deadlinesData] = await Promise.all([
        getComplianceEvents(month, year, isStatutory),
        getUpcomingDeadlines(30, isStatutory),
      ])
      setEvents(eventsData.events)
      setUpcomingDeadlines(deadlinesData.events)
      setUser(eventsData.user)
    } catch (error) {
      console.error("Failed to load compliance events:", error)
      toast.error("Failed to load compliance events")
    } finally {
      setLoading(false)
    }
  }, [currentDate, isStatutory])

  useEffect(() => { loadData() }, [loadData])

  const handleEventClick = (eventId: string) => {
    const event =
      events.find((e) => e.id === eventId) ||
      upcomingDeadlines.find((e) => e.id === eventId)
    if (event) { setSelectedEvent(event); setModalOpen(true) }
  }

  const handleDeleteEvent = async (eventId: string) => {
    const result = await deleteComplianceEvent(eventId)
    if (result.success) {
      toast.success("Event deleted")
      await loadData()
    } else {
      toast.error(result.error || "Failed to delete event")
    }
  }

  const canModify = user?.role === "PARTNER" || user?.role === "MANAGER"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading compliance calendar...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Statutory filing dates and the deadlines your managers set, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-2" asChild>
            <Link href="/notifications">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </Link>
          </Button>
          {canModify && (
            <Button
              size="sm"
              className="btn-glow h-9 gap-1.5 rounded-xl"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Add Event</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* What used to be two separate pages. */}
        <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.08] rounded-xl p-1 w-fit">
          {(Object.keys(SOURCE_LABELS) as SourceFilter[]).map((s) => (
            <Button
              key={s}
              variant={source === s ? "default" : "ghost"}
              size="sm"
              onClick={() => setSource(s)}
              className={cn("h-8 rounded-lg", source === s && "btn-glow")}
            >
              {SOURCE_LABELS[s]}
            </Button>
          ))}
        </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl p-1 w-fit">
        <Button
          variant={viewMode === "monthly" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("monthly")}
          className={cn("h-8 rounded-lg gap-2", viewMode === "monthly" && "btn-glow")}
        >
          <CalendarIcon className="h-4 w-4" />
          Monthly
        </Button>
        <Button
          variant={viewMode === "weekly" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("weekly")}
          className={cn("h-8 rounded-lg gap-2", viewMode === "weekly" && "btn-glow")}
        >
          <List className="h-4 w-4" />
          Weekly
        </Button>
      </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {viewMode === "monthly" ? (
            <MonthlyCalendar
              events={events}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onEventClick={handleEventClick}
              onAddEvent={canModify ? () => setAddOpen(true) : undefined}
              canModify={canModify}
            />
          ) : (
            <WeeklyAgenda
              events={events}
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onEventClick={handleEventClick}
            />
          )}
        </div>
        <div className="lg:col-span-1">
          <UpcomingDeadlines
            events={upcomingDeadlines}
            onEventClick={handleEventClick}
            days={30}
          />
        </div>
      </div>

      {/* Modals */}
      <ComplianceEventModal
        event={selectedEvent}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onRefresh={loadData}
        onDelete={handleDeleteEvent}
        currentUser={user}
      />

      {canModify && (
        <AddComplianceEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={() => { setAddOpen(false); loadData() }}
          forcedStatutory={isStatutory}
        />
      )}
    </div>
  )
}
