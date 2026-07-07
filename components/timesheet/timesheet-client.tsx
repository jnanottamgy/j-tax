"use client"

import { useCallback, useEffect, useState } from "react"
import { addDays, format, startOfWeek } from "date-fns"
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Square,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  deleteTimeEntry,
  getMyRunningTimer,
  getMyTimesheet,
  getTeamTimesheet,
  getTimesheetOptions,
  stopTimer,
  type MyTimesheet,
  type RunningTimer,
  type TeamTimesheetRow,
  type TimesheetEntry,
  type TimesheetOptions,
} from "@/app/actions/time-entries"
import { AddEntryDialog } from "@/components/timesheet/add-entry-dialog"
import { TeamTimesheetTable } from "@/components/timesheet/team-timesheet-table"
import { GlassCard } from "@/components/dashboard/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AppRole } from "@/lib/auth/types"
import { minutesToHhMm, secondsToClock } from "@/lib/time/format"
import { cn } from "@/lib/utils"

function mondayOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

function dayLabel(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function TimesheetClient({ viewerRole }: { viewerRole: AppRole }) {
  const canSeeTeam = viewerRole === "PARTNER" || viewerRole === "MANAGER"

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()))
  const weekISO = format(weekStart, "yyyy-MM-dd")
  const todayISO = format(new Date(), "yyyy-MM-dd")

  const [timesheet, setTimesheet] = useState<MyTimesheet | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loadingSheet, setLoadingSheet] = useState(true)

  const [running, setRunning] = useState<RunningTimer | null>(null)
  const [stopping, setStopping] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [options, setOptions] = useState<TimesheetOptions | null>(null)

  const [teamRows, setTeamRows] = useState<TeamTimesheetRow[] | null>(null)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [tab, setTab] = useState<"mine" | "team">("mine")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null)
  const [deletingEntry, setDeletingEntry] = useState<TimesheetEntry | null>(null)

  const loadMine = useCallback(async () => {
    setLoadingSheet(true)
    try {
      const [sheet, timer] = await Promise.all([
        getMyTimesheet(weekISO),
        getMyRunningTimer(),
      ])
      if ("error" in sheet) {
        setProfileError(sheet.error)
        setTimesheet(null)
      } else {
        setProfileError(null)
        setTimesheet(sheet)
      }
      setRunning(timer)
    } catch {
      toast.error("Failed to load timesheet")
    } finally {
      setLoadingSheet(false)
    }
  }, [weekISO])

  const loadTeam = useCallback(async () => {
    if (!canSeeTeam) return
    setLoadingTeam(true)
    try {
      const result = await getTeamTimesheet(weekISO)
      if ("error" in result) {
        toast.error(result.error)
        setTeamRows(null)
      } else {
        setTeamRows(result.rows)
      }
    } catch {
      toast.error("Failed to load team timesheet")
    } finally {
      setLoadingTeam(false)
    }
  }, [weekISO, canSeeTeam])

  useEffect(() => {
    loadMine()
  }, [loadMine])

  useEffect(() => {
    if (tab === "team") loadTeam()
  }, [tab, loadTeam])

  useEffect(() => {
    getTimesheetOptions()
      .then(setOptions)
      .catch(() => {
        // Options only power the add-entry dialog selects; fail quietly
      })
  }, [])

  // Live tick for the running-timer banner
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const handleStopTimer = async () => {
    setStopping(true)
    try {
      const result = await stopTimer()
      if (result.success) {
        toast.success(
          result.minutes !== undefined
            ? `Logged ${minutesToHhMm(result.minutes)}`
            : "Timer stopped"
        )
        await loadMine()
      } else {
        toast.error(result.error)
      }
    } finally {
      setStopping(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEntry) return
    const result = await deleteTimeEntry(deletingEntry.id)
    if (result.success) {
      toast.success("Time entry deleted")
      setDeletingEntry(null)
      await loadMine()
      if (tab === "team") await loadTeam()
    } else {
      toast.error(result.error)
    }
  }

  const openAddDialog = () => {
    setEditingEntry(null)
    setDialogOpen(true)
  }

  const openEditDialog = (entry: TimesheetEntry) => {
    setEditingEntry(entry)
    setDialogOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) setEditingEntry(null)
  }

  const elapsedSeconds = running
    ? Math.max(0, (nowMs - new Date(running.startedAt).getTime()) / 1000)
    : 0

  const runningLabel = running
    ? [running.clientName, running.taskTitle, running.description]
        .filter(Boolean)
        .join(" · ") || "Untracked work"
    : ""

  // Prefill the add dialog with today when it falls in the viewed week
  const defaultDate =
    timesheet && timesheet.days.some((d) => d.date === todayISO)
      ? todayISO
      : weekISO

  return (
    <div className="space-y-6">
      {/* Running timer banner */}
      {running && (
        <GlassCard
          hover={false}
          className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/[0.06] p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{runningLabel}</div>
              <div className="text-xs text-muted-foreground">
                Timer started at {timeLabel(running.startedAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl tabular-nums">
              {secondsToClock(elapsedSeconds)}
            </span>
            <Button
              variant="destructive"
              onClick={handleStopTimer}
              disabled={stopping}
            >
              {stopping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Week navigation + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous week"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center text-sm font-medium">
            {weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {" – "}
            {addDays(weekStart, 6).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next week"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setWeekStart(mondayOf(new Date()))}
          >
            This week
          </Button>
        </div>

        {!profileError && (
          <Button onClick={openAddDialog} className="btn-glow">
            <Plus className="h-4 w-4" />
            Log time
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "mine" | "team")}>
        {canSeeTeam && (
          <TabsList>
            <TabsTrigger value="mine">My timesheet</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="mine" className="space-y-6">
          {profileError ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
            >
              {profileError}. Ask a Partner to link an employee profile to your
              user account to start tracking time.
            </div>
          ) : loadingSheet && !timesheet ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : timesheet ? (
            <>
              {/* Week summary */}
              <div className="grid gap-4 sm:grid-cols-3">
                <GlassCard hover={false} className="p-4">
                  <div className="text-xs text-muted-foreground">Week total</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {minutesToHhMm(timesheet.weekTotalMinutes)}
                  </div>
                </GlassCard>
                <GlassCard hover={false} className="p-4">
                  <div className="text-xs text-muted-foreground">Billable</div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">
                    {minutesToHhMm(timesheet.billableMinutes)}
                  </div>
                </GlassCard>
                <GlassCard hover={false} className="p-4">
                  <div className="text-xs text-muted-foreground">
                    Non-billable
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {minutesToHhMm(timesheet.nonBillableMinutes)}
                  </div>
                </GlassCard>
              </div>

              {/* Day-by-day entries */}
              <div className="space-y-4">
                {timesheet.days.map((day) => (
                  <GlassCard
                    hover={false}
                    key={day.date}
                    className={cn(
                      "p-4",
                      day.date === todayISO && "border-primary/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        {dayLabel(day.date)}
                        {day.date === todayISO && (
                          <Badge variant="secondary">Today</Badge>
                        )}
                      </div>
                      <div className="text-sm tabular-nums text-muted-foreground">
                        {day.totalMinutes > 0 ? minutesToHhMm(day.totalMinutes) : "—"}
                      </div>
                    </div>

                    {day.entries.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {day.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <span className="font-medium">
                                  {entry.clientName ?? "No client"}
                                </span>
                                {entry.taskTitle && (
                                  <span className="truncate text-muted-foreground">
                                    · {entry.taskTitle}
                                  </span>
                                )}
                                {entry.running ? (
                                  <Badge className="border-transparent bg-primary/15 text-primary">
                                    Running
                                  </Badge>
                                ) : entry.billable ? (
                                  <Badge className="border-transparent bg-emerald-500/15 text-emerald-400">
                                    Billable
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Non-billable</Badge>
                                )}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                {entry.description || (
                                  <span className="italic">No description</span>
                                )}
                                {entry.endedAt && (
                                  <>
                                    {" · "}
                                    {timeLabel(entry.startedAt)} –{" "}
                                    {timeLabel(entry.endedAt)}
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <span className="mr-1 text-sm font-medium tabular-nums">
                                {minutesToHhMm(entry.minutes)}
                              </span>
                              {!entry.running && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Edit entry"
                                    onClick={() => openEditDialog(entry)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Delete entry"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => setDeletingEntry(entry)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>
            </>
          ) : null}
        </TabsContent>

        {canSeeTeam && (
          <TabsContent value="team">
            <TeamTimesheetTable rows={teamRows} loading={loadingTeam} />
          </TabsContent>
        )}
      </Tabs>

      {/* Add / Edit entry */}
      <AddEntryDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        options={options}
        entry={editingEntry}
        defaultDate={defaultDate}
        onSaved={() => {
          loadMine()
          if (tab === "team") loadTeam()
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deletingEntry !== null}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        title="Delete time entry?"
        description={
          deletingEntry
            ? `This removes ${minutesToHhMm(deletingEntry.minutes)} logged${
                deletingEntry.clientName ? ` for ${deletingEntry.clientName}` : ""
              }. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
