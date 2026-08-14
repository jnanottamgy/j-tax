import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { tenantContext } from "@/lib/tenant/context"
import { reportUnexpectedAbsences } from "@/lib/workforce/maintenance"

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

/**
 * Mid-morning: who has not turned up, and is not on leave.
 *
 * The workforce dashboard never said anything on its own, so spotting an
 * absence depended on somebody remembering to open a page. Runs at 11:30 IST
 * (06:00 UTC) — late enough that a slow start is not an absence, early enough
 * that the day can still be rearranged.
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

    let flagged = 0
    for (const firm of firms) {
      await tenantContext.run({ firmId: firm.id }, async () => {
        flagged += await reportUnexpectedAbsences()
      })
    }

    return NextResponse.json({
      success: true,
      message: `Flagged ${flagged} unexplained absence(s) across ${firms.length} firm(s).`,
    })
  } catch (error) {
    console.error("Attendance check CRON Error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}
