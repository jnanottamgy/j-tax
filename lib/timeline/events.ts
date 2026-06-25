import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type TimelineEventType =
  | "LEAD_CREATED" | "LEAD_STATUS_CHANGED"
  | "QUOTATION_CREATED" | "QUOTATION_SENT" | "QUOTATION_ACCEPTED" | "QUOTATION_REJECTED"
  | "CLIENT_ONBOARDED"
  | "DOCUMENT_UPLOADED" | "DOCUMENT_REQUESTED"
  | "TASK_CREATED" | "TASK_COMPLETED"
  | "COMPLIANCE_FILED" | "COMPLIANCE_OVERDUE"
  | "INVOICE_CREATED" | "INVOICE_SENT"
  | "PAYMENT_RECEIVED"
  | "EMAIL_SENT"
  | "NOTE_ADDED" | "EMPLOYEE_ASSIGNED"

export async function recordTimelineEvent(params: {
  clientId?: string | null
  leadId?: string | null
  eventType: TimelineEventType
  title: string
  description?: string | null
  metadata?: Prisma.InputJsonValue
  performedBy?: string | null
}) {
  try {
    if (!params.clientId && !params.leadId) return
    await prisma.clientTimelineEvent.create({
      data: {
        clientId: params.clientId || null,
        leadId: params.leadId || null,
        eventType: params.eventType as any,
        title: params.title,
        description: params.description || null,
        metadata: params.metadata || undefined,
        performedBy: params.performedBy || null,
      },
    })
  } catch {
    // Timeline events are best-effort — never block the primary action
  }
}
