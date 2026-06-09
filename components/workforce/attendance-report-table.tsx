"use client"

import { useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAttendanceReport } from "@/app/actions/workforce"
import { format } from "date-fns"

type ReportData = Awaited<ReturnType<typeof getAttendanceReport>>

export function AttendanceReportTable({ data: initial }: { data: ReportData }) {
  const [data, setData] = useState(initial)
  const [, startTransition] = useTransition()

  const now = new Date()
  const [year, setYear] = useState(data.year)
  const [month, setMonth] = useState(data.month)

  function navigate(direction: -1 | 1) {
    let newMonth = month + direction
    let newYear = year
    if (newMonth < 1) { newMonth = 12; newYear-- }
    if (newMonth > 12) { newMonth = 1; newYear++ }
    if (newYear > now.getFullYear() || (newYear === now.getFullYear() && newMonth > now.getMonth() + 1)) return
    setMonth(newMonth)
    setYear(newYear)
    startTransition(async () => {
      const fresh = await getAttendanceReport(newYear, newMonth)
      setData(fresh)
    })
  }

  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy")

  function exportCSV() {
    const rows = [
      ["Employee", "Department", "Present", "Late Login", "Half Day", "Absent", "On Leave", "Attendance %", "Avg Daily Hours"],
      ...data.summaries.map((s) => [
        s.employeeName,
        s.department ?? "",
        s.present,
        s.lateLogin,
        s.halfDay,
        s.absent,
        s.onLeave,
        `${s.attendanceRate}%`,
        `${(s.avgDailyMinutes / 60).toFixed(1)}h`,
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-${year}-${String(month).padStart(2, "0")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Attendance Report — {monthLabel}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{data.workingDays} working days</span>
            <div className="flex">
              <Button size="icon" variant="ghost" className="size-7" onClick={() => navigate(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => navigate(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={exportCSV}>
              <Download className="size-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="pl-4">Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Late</TableHead>
                <TableHead className="text-center">Half</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Leave</TableHead>
                <TableHead className="text-center">Rate</TableHead>
                <TableHead className="text-right pr-4">Avg Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    No attendance records for this month.
                  </TableCell>
                </TableRow>
              ) : (
                data.summaries.map((s) => (
                  <TableRow key={s.employeeId} className="border-white/[0.06]">
                    <TableCell className="pl-4 font-medium text-sm">{s.employeeName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.department ?? "—"}</TableCell>
                    <TableCell className="text-center">
                      <AttCell value={s.present} type="present" />
                    </TableCell>
                    <TableCell className="text-center">
                      <AttCell value={s.lateLogin} type="late" />
                    </TableCell>
                    <TableCell className="text-center">
                      <AttCell value={s.halfDay} type="half" />
                    </TableCell>
                    <TableCell className="text-center">
                      <AttCell value={s.absent} type="absent" />
                    </TableCell>
                    <TableCell className="text-center">
                      <AttCell value={s.onLeave} type="leave" />
                    </TableCell>
                    <TableCell className="text-center">
                      <RateBadge rate={s.attendanceRate} />
                    </TableCell>
                    <TableCell className="text-right pr-4 text-sm tabular-nums">
                      {s.avgDailyMinutes > 0 ? `${(s.avgDailyMinutes / 60).toFixed(1)}h` : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function AttCell({ value, type }: { value: number; type: string }) {
  if (value === 0) return <span className="text-muted-foreground text-xs">0</span>
  const colors: Record<string, string> = {
    present: "text-emerald-500",
    late: "text-yellow-500",
    half: "text-orange-400",
    absent: "text-red-500",
    leave: "text-blue-400",
  }
  return <span className={`font-medium text-sm ${colors[type] ?? ""}`}>{value}</span>
}

function RateBadge({ rate }: { rate: number }) {
  const cls = rate >= 90 ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
    : rate >= 75 ? "bg-yellow-500/15 text-yellow-600 border-yellow-500/20"
    : "bg-red-500/15 text-red-500 border-red-500/20"
  return <Badge variant="outline" className={`text-xs ${cls}`}>{rate}%</Badge>
}
