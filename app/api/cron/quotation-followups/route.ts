import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/messaging/notification-service"
import { followUpEmailHTML, followUpSubject } from "@/lib/quotations/email-templates"
import { getFirmSettings } from "@/lib/firm-settings"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return new NextResponse("Cron not configured", { status: 503 })

  const auth = request.headers.get("authorization") ?? ""
  if (!safeCompare(auth, `Bearer ${cronSecret}`)) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const now = new Date()
  let sent = 0
  let skipped = 0

  // Resolve firm identity once per cron tick — used for every email this run.
  const cfg = await getFirmSettings()

  try {
    // Find pending follow-ups where scheduledAt has passed
    const dueFollowUps = await prisma.quotationFollowUp.findMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: now },
      },
      include: {
        quotation: {
          select: {
            id: true,
            quotationNumber: true,
            clientName: true,
            clientEmail: true,
            total: true,
            token: true,
            status: true,
          },
        },
      },
    })

    for (const followUp of dueFollowUps) {
      const q = followUp.quotation

      // Skip if already accepted, rejected, or expired
      if (!["SENT", "VIEWED"].includes(q.status)) {
        await prisma.quotationFollowUp.update({
          where: { id: followUp.id },
          data: { status: "SKIPPED", sentAt: now },
        })
        skipped++
        continue
      }

      const viewUrl = `${APP_URL}/q/${q.token}`
      const dayNumber = followUp.followUpDay as 3 | 7 | 14

      const html = followUpEmailHTML({
        firmName: cfg.firmName,
        firmEmail: cfg.fromEmail,
        clientName: q.clientName,
        quotationNumber: q.quotationNumber,
        total: `₹${Number(q.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
        viewUrl,
        dayNumber,
      })

      const subject = followUpSubject(q.quotationNumber, dayNumber, cfg.firmName)

      const result = await notificationService.send({
        channel: "email",
        to: q.clientEmail,
        subject,
        content: html,
      })

      await prisma.$transaction([
        prisma.quotationFollowUp.update({
          where: { id: followUp.id },
          data: { status: result.success ? "SENT" : "SKIPPED", sentAt: now },
        }),
        prisma.quotationEmailLog.create({
          data: {
            quotationId: q.id,
            resendId: result.messageId || null,
            emailType: `FOLLOWUP_${dayNumber}`,
            to: q.clientEmail,
            subject,
            status: result.success ? "SENT" : "FAILED",
          },
        }),
      ])

      if (result.success) sent++
      else skipped++
    }

    return NextResponse.json({ success: true, sent, skipped })
  } catch (err) {
    console.error("Quotation follow-up cron error:", err)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}
