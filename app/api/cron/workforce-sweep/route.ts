import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { tenantContext } from "@/lib/tenant/context"
import { sweepStaleSessions } from "@/lib/workforce/tracker"
import { markLeaveAttendance, purgeOldSessions } from "@/lib/workforce/maintenance"

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

/**
 * Nightly tidy-up of the workforce record.
 *
 * Three jobs, all of which exist because people close tabs rather than sign
 * out, and because leave was never reflected in attendance:
 *
 *  - Close sessions whose heartbeats stopped, booking the time up to the last
 *    beat. Without this a forgotten tab kept a session open indefinitely and
 *    the day's hours were never written at all.
 *  - Mark approved leave as ON_LEAVE attendance, so time off reads as time off
 *    rather than as absence.
 *  - Drop session rows past their retention window. Each holds an IP address
 *    and a user agent; keeping those for ever is a liability with no upside.
 *
 * Scheduled for the evening rather than the small hours so a day's hours are
 * closed off while it is still that day.
 */
export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return new NextResponse("CRON_SECRET not configured", { status: 503 })
    }
    const authHeader = request.headers.get("authorization") ?? ""
    if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const firms = await prisma.firm.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    })

    let closed = 0
    let leaveMarked = 0
    let purged = 0

    for (const firm of firms) {
      await tenantContext.run({ firmId: firm.id }, async () => {
        closed += await sweepStaleSessions()
        leaveMarked += await markLeaveAttendance()
        purged += await purgeOldSessions()
      })
    }

    return NextResponse.json({
      success: true,
      message: `Closed ${closed} stale session(s), marked ${leaveMarked} leave day(s), purged ${purged} old session row(s).`,
    })
  } catch (error) {
    console.error("Workforce sweep CRON Error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}
