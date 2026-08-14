import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { subDays } from "date-fns"

import { prisma } from "@/lib/prisma"
import { tenantContext } from "@/lib/tenant/context"

/**
 * Task automation cron:
 *  (a) mark overdue  — dueDate < now, status ≠ FILED_DONE → isOverdue: true
 *  (b) escalate      — overdue > 3 days, not yet escalated → escalated: true,
 *      escalationLevel: 1, TASK_OVERDUE notification to the assignee and to
 *      the client's assigned employee (deduped when they are the same person).
 *
 * Idempotent per run: (a) filters isOverdue: false, (b) filters escalated:
 * false, so re-running the cron never double-flags or double-notifies.
 */

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

const ESCALATION_AFTER_DAYS = 3

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

    const now = new Date()

    // Multi-tenant: escalations notify each firm's own Partners/Managers.
    const firms = await prisma.firm.findMany({ where: { status: "ACTIVE" }, select: { id: true } })
    let markedOverdue = 0
    let escalated = 0
    let notificationsCreated = 0
    const errors: string[] = []
    for (const firm of firms) {
      await tenantContext.run({ firmId: firm.id }, async () => {

    // (a) Mark overdue — one idempotent bulk update
    const overdueResult = await prisma.task.updateMany({
      where: {
        dueDate: { lt: now },
        status: { not: "FILED_DONE" },
        isOverdue: false,
      },
      data: { isOverdue: true },
    })

    // (b) Escalate tasks overdue for more than 3 days
    const escalationThreshold = subDays(now, ESCALATION_AFTER_DAYS)
    const tasksToEscalate = await prisma.task.findMany({
      where: {
        dueDate: { lt: escalationThreshold },
        status: { not: "FILED_DONE" },
        escalated: false,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedEmployee: { select: { userId: true } },
        client: {
          select: {
            name: true,
            assignedEmployee: { select: { userId: true } },
          },
        },
      },
    })

    for (const task of tasksToEscalate) {
      try {
        await prisma.task.update({
          where: { id: task.id },
          data: { escalated: true, escalationLevel: 1, isOverdue: true },
        })
        escalated++
      } catch (err) {
        errors.push(`Failed to escalate task ${task.id}: ${String(err)}`)
        continue
      }

      // Notify the assignee, the client's owner — and management.
      //
      // This used to tell only the first two, which are the people already
      // closest to the task and already late. An escalation that reaches
      // nobody above the person who missed the deadline is not an escalation,
      // and three days past due on a statutory filing is exactly when a
      // partner needs to know without being asked.
      const recipients = new Set<string>()
      if (task.assignedEmployee?.userId) {
        recipients.add(task.assignedEmployee.userId)
      }
      if (task.client.assignedEmployee?.userId) {
        recipients.add(task.client.assignedEmployee.userId)
      }
      const management = await prisma.user.findMany({
        where: { role: { in: ["PARTNER", "MANAGER"] } },
        select: { id: true },
      })
      for (const u of management) recipients.add(u.id)

      for (const userId of recipients) {
        try {
          await prisma.notification.create({
            data: {
              userId,
              title: "Task overdue — escalated",
              message: `"${task.title}" for ${task.client.name} is more than ${ESCALATION_AFTER_DAYS} days overdue.`,
              type: "TASK_OVERDUE",
              entityType: "TASK",
              entityId: task.id,
            },
          })
          notificationsCreated++
        } catch (err) {
          errors.push(`Failed to notify ${userId} for task ${task.id}: ${String(err)}`)
        }
      }
    }

    markedOverdue += overdueResult.count
      }) // tenantContext.run
    } // firms loop

    return NextResponse.json({
      success: true,
      markedOverdue,
      escalated,
      notificationsCreated,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    console.error("Task automation CRON Error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}
