import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { addDays, format } from "date-fns"
import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/messaging/notification-service"
import { getFirmSettings, type FirmConfig } from "@/lib/firm-settings"

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
      return new NextResponse("CRON_SECRET not configured", { status: 503 })
    }

    const authHeader = request.headers.get("authorization") ?? ""
    if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const results = {
      complianceReminders: 0,
      documentReminders: 0,
      overdueAlerts: 0,
      errors: [] as string[],
    }

    // Pull firm branding once per cron tick so every email carries the firm's identity
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
            assignedEmployeeId: true,
          },
        },
      },
    })

    for (const event of upcomingEvents) {
      if (!event.client?.email) continue

      try {
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
            metadata: { type: "compliance_reminder", complianceEventId: event.id },
          },
        })

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

    // 3. Document expiry reminders
    const expiringDocs = await prisma.document.findMany({
      where: {
        expiryDate: { gte: now, lte: addDays(now, 30) },
      },
      include: {
        client: { select: { id: true, name: true, email: true, assignedEmployeeId: true } },
      },
    })

    for (const doc of expiringDocs) {
      if (!doc.client?.email) continue

      try {
        const alreadySent = await prisma.message.findFirst({
          where: {
            clientId: doc.clientId,
            metadata: { path: ["type"], equals: "document_expiry_reminder" },
            content: { contains: doc.title },
            sentAt: { gte: addDays(now, -7) },
          },
        })
        if (alreadySent) continue

        await notificationService.send({
          channel: "email",
          to: doc.client.email,
          subject: `Document Expiring Soon: ${doc.title}`,
          content: buildDocumentExpiryEmail(doc.client.name, doc.title, doc.expiryDate!, cfg),
        })

        await prisma.message.create({
          data: {
            clientId: doc.clientId,
            phoneNumber: doc.client.email,
            content: `Document expiry reminder: ${doc.title} expires ${format(doc.expiryDate!, "dd MMM yyyy")}`,
            status: "SENT",
            sentAt: now,
            sentBy: "SYSTEM",
            metadata: { type: "document_expiry_reminder", documentId: doc.id },
          },
        })

        if (doc.client.assignedEmployeeId) {
          const emp = await prisma.employee.findUnique({
            where: { id: doc.client.assignedEmployeeId },
            select: { userId: true },
          })
          if (emp?.userId) {
            await prisma.notification.create({
              data: {
                userId: emp.userId,
                title: "Document Expiring Soon",
                message: `${doc.title} for ${doc.client.name} expires on ${format(doc.expiryDate!, "dd MMM yyyy")}`,
                type: "WARNING",
                entityType: "DOCUMENT",
                entityId: doc.id,
              },
            })
          }
        }

        results.documentReminders++
      } catch (err) {
        results.errors.push(`Doc expiry ${doc.id}: ${err instanceof Error ? err.message : "Unknown"}`)
      }
    }

    return NextResponse.json({
      success: true,
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

function buildDocumentExpiryEmail(clientName: string, docTitle: string, expiryDate: Date, cfg: FirmConfig): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1e3a8a; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0;">Document Expiring Soon</h2>
    <p style="margin: 6px 0 0; color: #bfdbfe; font-size: 13px;">${cfg.firmName}</p>
  </div>
  <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Dear ${clientName},</p>
    <p>The following document is expiring soon and may need renewal:</p>
    <div style="background: #fee2e2; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <strong>${docTitle}</strong><br/>
      <span style="color: #991b1b;">Expires: ${format(expiryDate, "dd MMMM yyyy")}</span>
    </div>
    <p>Please arrange for renewal and submit the updated document.</p>
    <p>Best regards,<br/>${cfg.firmName}</p>
    ${firmFooter(cfg)}
  </div>
</div>`
}
