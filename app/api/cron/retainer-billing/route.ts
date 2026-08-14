import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { runRetainerBilling } from "@/lib/billing/retainer-engine"
import { prisma } from "@/lib/prisma"
import { tenantContext } from "@/lib/tenant/context"

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

/**
 * Raise the invoices retainer engagements owe.
 *
 * Runs daily rather than monthly on purpose: engagements bill on their own
 * anniversary, not all on the 1st, and a daily pass means a schedule that
 * starts mid-month bills on the right day instead of waiting for the next
 * month boundary. The engine is idempotent per client-service-period, so a
 * second run in the same day creates nothing.
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

    let created = 0
    const capped: string[] = []
    const errors: string[] = []
    let skippedNoFee = 0

    for (const firm of firms) {
      await tenantContext.run({ firmId: firm.id }, async () => {
        const r = await runRetainerBilling()
        created += r.created
        skippedNoFee += r.skipped["no-fee"]
        capped.push(...r.capped)
        errors.push(...r.errors)
      })
    }

    return NextResponse.json({
      success: true,
      message: `Raised ${created} draft retainer invoice(s) across ${firms.length} firm(s).`,
      // Surfaced rather than swallowed: an engagement with no agreed fee bills
      // nothing, and silence would read as "nothing was due".
      skippedNoAgreedFee: skippedNoFee || undefined,
      cappedCatchUp: capped.length > 0 ? capped : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    console.error("Retainer billing CRON Error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}
