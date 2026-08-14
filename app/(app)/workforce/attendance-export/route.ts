import { NextResponse } from "next/server"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { toCsv } from "@/lib/csv/parse"

/**
 * A month of attendance, as a spreadsheet.
 *
 * Payroll needs days present, days late and hours per person per month, and
 * nothing produced it — the numbers existed only inside a dashboard, so every
 * month somebody read them off a screen and retyped them.
 *
 * ?month=YYYY-MM, defaulting to the current one.
 */
export async function GET(request: Request) {
  try {
    await requirePartnerOrManager()
  } catch {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const url = new URL(request.url)
  const monthParam = url.searchParams.get("month") ?? ""
  const m = monthParam.match(/^(\d{4})-(\d{2})$/)
  const now = new Date()
  const year = m ? Number(m[1]) : now.getFullYear()
  const month = m ? Number(m[2]) - 1 : now.getMonth()

  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999)

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      attendanceRecords: {
        where: { date: { gte: from, lte: to } },
        select: { status: true, workMinutes: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const rows = employees.map((e) => {
    const present = e.attendanceRecords.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE_LOGIN"
    ).length
    const late = e.attendanceRecords.filter((r) => r.status === "LATE_LOGIN").length
    const half = e.attendanceRecords.filter((r) => r.status === "HALF_DAY").length
    const leave = e.attendanceRecords.filter((r) => r.status === "ON_LEAVE").length
    const absent = e.attendanceRecords.filter((r) => r.status === "ABSENT").length
    const minutes = e.attendanceRecords.reduce((s, r) => s + (r.workMinutes ?? 0), 0)

    return [
      e.name,
      e.email ?? "",
      e.department ?? "",
      present,
      late,
      half,
      leave,
      absent,
      // Hours to one decimal — payroll works in hours, not minutes.
      (minutes / 60).toFixed(1),
    ]
  })

  const csv = toCsv(
    [
      "Name",
      "Email",
      "Department",
      "Days present",
      "Of which late",
      "Half days",
      "Days on leave",
      "Days absent",
      "Hours worked",
    ],
    rows
  )

  const label = `${year}-${String(month + 1).padStart(2, "0")}`
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Attendance-${label}.csv"`,
    },
  })
}
