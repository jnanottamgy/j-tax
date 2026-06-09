import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

    // 1. Find all unpaid invoices past their due date that aren't already marked OVERDUE (or DISPUTED/WAIVED)
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ["PAID", "OVERDUE", "DISPUTED", "WAIVED"] },
      },
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

      // 4. Create internal notifications
      const notifications = []
      for (const inv of overdueInvoices) {
        for (const user of managers) {
          notifications.push({
            userId: user.id,
            title: "Invoice Overdue",
            message: `Invoice ${inv.invoiceNumber} for ${inv.client.name} is now overdue (₹${inv.outstandingAmount}).`,
            type: "ALERT" as const,
          })
        }
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications as any,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${overdueInvoices.length} newly overdue invoices.`,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Payment CRON Error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
