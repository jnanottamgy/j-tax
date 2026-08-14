import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { addDays, format } from "date-fns"
import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/messaging/notification-service"
import { isWhatsAppConfigured } from "@/lib/messaging/whatsapp-api"
import { getFirmSettings, type FirmConfig } from "@/lib/firm-settings"
import { tenantContext } from "@/lib/tenant/context"
import { notifyRoles, notifyUser } from "@/lib/notifications/notify"

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

/**
 * Optionally send a WhatsApp reminder alongside the email.
 *
 * Business-initiated WhatsApp messages MUST use a Meta-approved template, so
 * each reminder type is gated on an env var holding the approved template
 * name (e.g. WHATSAPP_TEMPLATE_COMPLIANCE_REMINDER=compliance_reminder).
 * Unset env var or missing credentials → silently skipped; the email is the
 * canonical reminder either way.
 */
/**
 * Tell a human that a reminder could not be sent.
 *
 * The app knows two things at once here: a statutory deadline is inside a week,
 * and this client cannot be emailed. That combination is exactly when somebody
 * should pick up the phone, so it goes to whoever owns the client — falling
 * back to the partners when nobody does, because an unassigned uncontactable
 * client is worse, not better.
 *
 * Deduped per event on the same 8-day window the email reminder uses (7-day
 * window plus a day of slack for cron drift), so a daily cron raises this once
 * per deadline rather than every morning until the due date.
 */
async function notifyUnreachableClient(
  event: {
    id: string
    title: string
    dueDate: Date
    client: { id: string; name: string; phone: string | null; assignedEmployeeId: string | null } | null
  },
  now: Date
): Promise<void> {
  const client = event.client
  if (!client) return

  const already = await prisma.notification.findFirst({
    where: {
      entityType: "COMPLIANCE",
      entityId: event.id,
      type: "WARNING",
      createdAt: { gte: addDays(now, -8) },
    },
    select: { id: true },
  })
  if (already) return

  const reach = client.phone
    ? `No email address on record — call ${client.phone}.`
    : "No email address and no phone number on record."
  const payload = {
    title: `Reminder not sent: ${client.name} has no email address`,
    message: `${event.title} is due on ${format(event.dueDate, "dd MMM yyyy")} and the automatic reminder could not be sent. ${reach}`,
    type: "WARNING" as const,
    entityType: "COMPLIANCE" as const,
    entityId: event.id,
  }

  if (client.assignedEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: client.assignedEmployeeId },
      select: { userId: true },
    })
    if (employee?.userId) {
      await notifyUser(employee.userId, payload)
      return
    }
  }

  await notifyRoles(["PARTNER"], payload)
}

async function sendWhatsAppReminderIfEnabled(opts: {
  templateEnv: "WHATSAPP_TEMPLATE_COMPLIANCE_REMINDER"
  to: string | null | undefined
  variables: Record<string, string>
  clientId: string
  logContent: string
  metadata: Record<string, unknown>
  now: Date
}): Promise<boolean> {
  const templateName = process.env[opts.templateEnv]
  if (!templateName || !isWhatsAppConfigured() || !opts.to) return false

  const result = await notificationService.send(
    {
      channel: "whatsapp",
      to: opts.to,
      templateName,
      variables: opts.variables,
    },
    0 // template rejections are permanent — don't retry inside a cron tick
  )

  await prisma.message.create({
    data: {
      clientId: opts.clientId,
      phoneNumber: opts.to,
      content: opts.logContent,
      status: result.success ? "SENT" : "FAILED",
      sentAt: result.success ? opts.now : null,
      failedAt: result.success ? null : opts.now,
      errorMessage: result.success ? null : result.error,
      sentBy: "SYSTEM",
      metadata: {
        ...opts.metadata,
        provider: "WHATSAPP",
        ...(result.messageId ? { externalId: result.messageId } : {}),
      },
    },
  })

  return result.success
}

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

    const results = {
      complianceReminders: 0,
      overdueAlerts: 0,
      whatsappReminders: 0,
      noticeAlerts: 0,
      /** Deadlines whose client has no email address, so no reminder went out. */
      unreachableClients: 0,
      errors: [] as string[],
    }

    // ── Multi-tenant: process every active firm inside its own tenant
    // context. All Prisma queries in the body auto-scope to that firm, and
    // getFirmSettings() resolves that firm's branding.
    const firms = await prisma.firm.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    })

    for (const firm of firms) {
      await tenantContext.run({ firmId: firm.id }, async () => {

    // Pull firm branding once per firm so every email carries its identity
    const cfg = await getFirmSettings()

    // 1. Compliance deadline reminders
    const now = new Date()
    const upcomingEvents = await prisma.complianceEvent.findMany({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { gte: now, lte: addDays(now, 7) },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsapp: true,
            phone: true,
            assignedEmployeeId: true,
          },
        },
      },
      // Deterministic order so the per-event dedupe below behaves the same way
      // on every run.
      orderBy: {
        dueDate: "asc",
      },
    })

    for (const event of upcomingEvents) {
      // No email address, no reminder. Skipping is right — a nightly cron must
      // not die on one incomplete client row — but it used to end here, and
      // that was the whole failure: the client heard nothing, the firm heard
      // nothing, and the deadline arrived anyway. The reminder becomes a job
      // for whoever owns the client instead of disappearing.
      if (!event.client?.email) {
        results.unreachableClients++
        try {
          await notifyUnreachableClient(event, now)
        } catch (err) {
          results.errors.push(
            `Unreachable-client alert for ${event.client?.name ?? "unknown client"}: ${
              err instanceof Error ? err.message : "Unknown"
            }`
          )
        }
        continue
      }

      try {
        // Dedupe: send at most one reminder per event per 7-day window. An event
        // stays in the window for at most 7 days, so looking back 8 days (one day
        // of slack for cron drift) means it is emailed once, when it first enters.
        const alreadySent = await prisma.message.findFirst({
          where: {
            clientId: event.client.id,
            AND: [
              { metadata: { path: ["type"], equals: "compliance_reminder" } },
              { metadata: { path: ["complianceEventId"], equals: event.id } },
            ],
            sentAt: { gte: addDays(now, -8) },
          },
        })
        if (alreadySent) continue

        await notificationService.send({
          channel: "email",
          to: event.client.email,
          subject: `Compliance Deadline Approaching: ${event.title}`,
          content: buildComplianceReminderEmail(
            event.client.name,
            event.title,
            event.dueDate,
            cfg
          ),
        })

        await prisma.message.create({
          data: {
            clientId: event.client.id,
            phoneNumber: event.client.email,
            content: `Compliance reminder: ${event.title} due ${format(event.dueDate, "dd MMM yyyy")}`,
            status: "SENT",
            sentAt: now,
            sentBy: "SYSTEM",
            metadata: { type: "compliance_reminder", complianceEventId: event.id, provider: "EMAIL" },
          },
        })

        // Optional WhatsApp copy (env-gated approved template)
        if (
          await sendWhatsAppReminderIfEnabled({
            templateEnv: "WHATSAPP_TEMPLATE_COMPLIANCE_REMINDER",
            to: event.client.whatsapp || event.client.phone,
            variables: {
              client_name: event.client.name,
              compliance_title: event.title,
              due_date: format(event.dueDate, "dd MMM yyyy"),
            },
            clientId: event.client.id,
            logContent: `WhatsApp compliance reminder: ${event.title} due ${format(event.dueDate, "dd MMM yyyy")}`,
            metadata: { type: "compliance_reminder", complianceEventId: event.id },
            now,
          })
        ) {
          results.whatsappReminders++
        }

        // Notify assigned employee
        if (event.client.assignedEmployeeId) {
          const employee = await prisma.employee.findUnique({
            where: { id: event.client.assignedEmployeeId },
            select: { userId: true },
          })
          if (employee?.userId) {
            await prisma.notification.create({
              data: {
                userId: employee.userId,
                title: "Compliance Deadline Approaching",
                message: `${event.title} for ${event.client.name} is due on ${format(event.dueDate, "dd MMM yyyy")}`,
                type: "COMPLIANCE_DUE",
                entityType: "COMPLIANCE",
                entityId: event.id,
              },
            })
          }
        }

        results.complianceReminders++
      } catch (err) {
        results.errors.push(`Compliance reminder for ${event.client.name}: ${err instanceof Error ? err.message : "Unknown"}`)
      }
    }

    // 2. Overdue task alerts to employees
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { in: ["NOT_STARTED", "IN_PROGRESS", "DATA_AWAITED"] },
        dueDate: { lt: now },
        isOverdue: false,
      },
      include: {
        client: { select: { name: true } },
        assignedEmployee: { select: { id: true, userId: true } },
      },
    })

    for (const task of overdueTasks) {
      try {
        await prisma.task.update({
          where: { id: task.id },
          data: { isOverdue: true },
        })

        if (task.assignedEmployee?.userId) {
          await prisma.notification.create({
            data: {
              userId: task.assignedEmployee.userId,
              title: "Task Overdue",
              message: `"${task.title}" for ${task.client.name} is now overdue`,
              type: "TASK_OVERDUE",
              entityType: "TASK",
              entityId: task.id,
            },
          })
        }

        // Alert managers
        const managers = await prisma.user.findMany({ where: { role: { in: ["PARTNER", "MANAGER"] } } })
        if (managers.length > 0) {
          await prisma.notification.createMany({
            data: managers.map((m) => ({
              userId: m.id,
              title: "Task Overdue",
              message: `"${task.title}" for ${task.client.name} is now overdue`,
              type: "TASK_OVERDUE" as const,
              entityType: "TASK" as const,
              entityId: task.id,
            })),
          })
        }

        results.overdueAlerts++
      } catch (err) {
        results.errors.push(`Overdue task ${task.id}: ${err instanceof Error ? err.message : "Unknown"}`)
      }
    }

    // ── 3. Tax-notice deadline alerts (staff, in-app) ────────────────────────
    // Reply deadlines at T−7/3/1/0 and hearings at T−3/1/0. Exact-day matching
    // on a daily cron means no dedupe table is needed.
    try {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const horizon = addDays(todayStart, 8)
      const openNotices = await prisma.taxNotice.findMany({
        where: {
          status: { notIn: ["CLOSED_FAVOURABLE", "CLOSED_UNFAVOURABLE", "CLOSED_PARTIAL"] },
          OR: [
            { replyDueDate: { gte: todayStart, lt: horizon } },
            { hearingDate: { gte: todayStart, lt: horizon } },
          ],
        },
        include: {
          client: { select: { name: true } },
          assignedEmployee: { select: { userId: true } },
        },
      })

      let partnerUserIds: string[] | null = null
      const daysUntil = (d: Date) =>
        Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - todayStart.getTime()) / 86_400_000)

      for (const notice of openNotices) {
        const alerts: Array<{ kind: "reply" | "hearing"; days: number }> = []
        if (notice.replyDueDate) {
          const d = daysUntil(notice.replyDueDate)
          if ([7, 3, 1, 0].includes(d)) alerts.push({ kind: "reply", days: d })
        }
        if (notice.hearingDate) {
          const d = daysUntil(notice.hearingDate)
          if ([3, 1, 0].includes(d)) alerts.push({ kind: "hearing", days: d })
        }
        if (alerts.length === 0) continue

        // Assigned staff member, else every partner
        let userIds: string[]
        if (notice.assignedEmployee?.userId) {
          userIds = [notice.assignedEmployee.userId]
        } else {
          if (partnerUserIds === null) {
            partnerUserIds = (
              await prisma.user.findMany({ where: { role: "PARTNER" }, select: { id: true } })
            ).map((u) => u.id)
          }
          userIds = partnerUserIds
        }

        for (const alert of alerts) {
          const when = alert.days === 0 ? "TODAY" : `in ${alert.days} day${alert.days === 1 ? "" : "s"}`
          for (const userId of userIds) {
            try {
              await prisma.notification.create({
                data: {
                  userId,
                  title:
                    alert.kind === "reply"
                      ? `Notice reply due ${when}: ${notice.noticeType}`
                      : `Hearing ${when}: ${notice.noticeType}`,
                  message: `${notice.client.name} — ${notice.noticeType}${notice.section ? ` (${notice.section})` : ""}${notice.authority ? `, ${notice.authority}` : ""}.`,
                  type: alert.days <= 1 ? "WARNING" : "INFO",
                  entityType: "CLIENT",
                  entityId: notice.clientId,
                },
              })
              results.noticeAlerts++
            } catch (err) {
              results.errors.push(
                `Notice alert ${notice.id}: ${err instanceof Error ? err.message : "Unknown"}`
              )
            }
          }
        }
      }
    } catch (err) {
      results.errors.push(
        `Notice alert step: ${err instanceof Error ? err.message : "Unknown"}`
      )
    }

      }) // tenantContext.run — end of this firm's slice
    } // firms loop

    return NextResponse.json({
      success: true,
      firmsProcessed: firms.length,
      ...results,
    })
  } catch (error: unknown) {
    console.error("Reminders CRON Error:", error)
    return NextResponse.json({ success: false, error: "Cron job failed." }, { status: 500 })
  }
}

function firmFooter(cfg: FirmConfig): string {
  const contactBits = [
    cfg.fromEmail ? `Email: ${cfg.fromEmail}` : "",
    cfg.firmPhone ? `Phone: ${cfg.firmPhone}` : "",
    cfg.website ? `Web: ${cfg.website}` : "",
  ].filter(Boolean).join(" &nbsp;|&nbsp; ")
  return `
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;">
      <p style="margin:0 0 6px 0;"><strong style="color:#1f2937;">${cfg.firmName}</strong></p>
      ${contactBits ? `<p style="margin:0;">${contactBits}</p>` : ""}
      ${cfg.firmAddress ? `<p style="margin:6px 0 0 0;font-size:12px;">${cfg.firmAddress}</p>` : ""}
    </div>`
}

function buildComplianceReminderEmail(clientName: string, title: string, dueDate: Date, cfg: FirmConfig): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1e3a8a; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">Compliance Deadline Approaching</h2>
    <p style="margin: 6px 0 0; color: #bfdbfe; font-size: 13px;">${cfg.firmName}</p>
  </div>
  <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Dear ${clientName},</p>
    <p>This is a reminder that the following compliance task is due soon:</p>
    <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <strong>${title}</strong><br/>
      <span style="color: #92400e;">Due Date: ${format(dueDate, "dd MMMM yyyy")}</span>
    </div>
    <p>Please submit any pending documents or information at your earliest convenience.</p>
    <p>Best regards,<br/>${cfg.firmName}</p>
    ${firmFooter(cfg)}
  </div>
</div>`
}
