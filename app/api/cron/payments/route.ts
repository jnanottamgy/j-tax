import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { overdueSweepFilter } from "@/lib/billing/overdue"
import { tenantContext } from "@/lib/tenant/context"

// HIGH-05: constant-time comparison to prevent timing attacks on the cron secret
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error("Payment CRON Error: CRON_SECRET is not configured")
      return new NextResponse("Cron secret is not configured", { status: 503 })
    }

    const authHeader = request.headers.get("authorization") ?? ""
    if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const now = new Date()

    // Multi-tenant: mark overdue + notify inside each firm's own context so
    // invoice queries and Partner/Manager lookups never cross firms.
    const firms = await prisma.firm.findMany({ where: { status: "ACTIVE" }, select: { id: true } })
    let totalOverdue = 0
    let totalRecovered = 0
    for (const firm of firms) {
      await tenantContext.run({ firmId: firm.id }, async () => {

    // 1. Invoices that have actually been issued and are past their due date.
    // Selection lives in lib/billing/overdue.ts: the old exclusion filter here
    // swept in DRAFT invoices, which the client has never been sent.
    const overdueInvoices = await prisma.invoice.findMany({
      where: overdueSweepFilter(now),
      include: { client: true },
    })

    if (overdueInvoices.length > 0) {
      // 2. Mark them as OVERDUE
      await prisma.invoice.updateMany({
        where: {
          id: { in: overdueInvoices.map((inv) => inv.id) },
        },
        data: {
          status: "OVERDUE",
        },
      })

      // 3. Find Partners/Managers to notify
      const managers = await prisma.user.findMany({
        where: { role: { in: ["PARTNER", "MANAGER"] } },
      })

      // 4. Create internal notifications, linked to the invoice so the alert
      // opens the thing it is about rather than dead-ending on the dashboard.
      const notifications = []
      for (const inv of overdueInvoices) {
        for (const user of managers) {
          notifications.push({
            userId: user.id,
            title: "Invoice Overdue",
            message: `Invoice ${inv.invoiceNumber} for ${inv.client.name} is now overdue (₹${inv.outstandingAmount}).`,
            type: "ALERT" as const,
            entityType: "INVOICE" as const,
            entityId: inv.id,
          })
        }
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications as any,
        })
      }
    }

    // 5. The other direction. OVERDUE was a one-way flag: nothing anywhere
    // cleared it, so extending a due date — the ordinary answer to "can we
    // have another fortnight" — left the invoice permanently late, and every
    // ageing report counted it. Put back the ones that are no longer true.
    const recovered = await prisma.invoice.updateMany({
      where: {
        status: "OVERDUE",
        OR: [{ dueDate: { gte: now } }, { outstandingAmount: { lte: 0 } }],
      },
      data: { status: "SENT" },
    })
    totalRecovered += recovered.count

    totalOverdue += overdueInvoices.length
      }) // tenantContext.run
    } // firms loop

    return NextResponse.json({
      success: true,
      message: `Processed ${totalOverdue} newly overdue and cleared ${totalRecovered} no-longer-overdue invoice(s) across ${firms.length} firm(s).`,
    })
  } catch (error: unknown) {
    // Log full detail server-side; return a generic message so internal
    // errors (stack hints, DB errors) aren't echoed to any caller.
    console.error("Payment CRON Error:", error)
    return NextResponse.json(
      { success: false, error: "Cron job failed." },
      { status: 500 }
    )
  }
}
