"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calendar as CalendarIcon, LayoutGrid, List, Plus, Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MonthlyCalendar } from "@/components/compliance/monthly-calendar"
import { WeeklyAgenda } from "@/components/compliance/weekly-agenda"
import { UpcomingDeadlines } from "@/components/compliance/upcoming-deadlines"
import { ComplianceEventModal } from "@/components/compliance/compliance-event-modal"
import { AddComplianceEventDialog } from "@/components/compliance/add-compliance-event-dialog"
import {
  getComplianceEvents,
  getUpcomingDeadlines,
  updateComplianceEventStatus,
  deleteComplianceEvent,
} from "@/app/actions/compliance"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type ViewMode = "monthly" | "weekly"

export function ComplianceCalendarClient() {
  const router = useRouter()
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
        getComplianceEvents(month, year),
        getUpcomingDeadlines(30),
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
  }, [currentDate])

  useEffect(() => { loadData() }, [loadData])

  const handleEventClick = (eventId: string) => {
    const event =
      events.find((e) => e.id === eventId) ||
      upcomingDeadlines.find((e) => e.id === eventId)
    if (event) { setSelectedEvent(event); setModalOpen(true) }
  }

  const handleStatusUpdate = async (eventId: string, status: any) => {
    const result = await updateComplianceEventStatus(eventId, status)
    if (result.success) {
      toast.success("Status updated")
      await loadData()
    } else {
      toast.error(result.error || "Failed to update status")
    }
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
          <h1 className="text-2xl font-semibold tracking-tight">Compliance Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track statutory deadlines, filings, and compliance events.
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
        onStatusUpdate={handleStatusUpdate}
        onDelete={handleDeleteEvent}
        currentUser={user}
      />

      {canModify && (
        <AddComplianceEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={() => { setAddOpen(false); loadData() }}
        />
      )}
    </div>
  )
}
