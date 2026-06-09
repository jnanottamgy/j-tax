/**
 * Notification Service
 * 
 * Centralized service for creating and managing notifications.
 * Handles all notification types with proper RBAC compliance.
 */

import { prisma } from "@/lib/prisma"

// Notification types matching the Prisma enum
export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_OVERDUE"
  | "COMPLIANCE_DUE"
  | "PAYMENT_RECEIVED"
  | "INVOICE_OVERDUE"
  | "DOCUMENT_UPLOADED"
  | "INFO"
  | "WARNING"
  | "ALERT"

// Notification entity types matching the Prisma enum
export type NotificationEntityType =
  | "TASK"
  | "COMPLIANCE"
  | "INVOICE"
  | "PAYMENT"
  | "DOCUMENT"
  | "CLIENT"
  | "USER"

export interface NotificationData {
  userId: string
  title: string
  message: string
  type: NotificationType
  entityType?: NotificationEntityType
  entityId?: string
  actionType?: string
}

/**
 * Create a single notification
 */
export async function createNotification(data: NotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        entityType: data.entityType,
        entityId: data.entityId,
        actionType: data.actionType,
      },
    })
    return { success: true, notification }
  } catch (error) {
    console.error("Failed to create notification:", error)
    return { success: false, error: "Failed to create notification" }
  }
}

/**
 * Create multiple notifications in batch
 */
export async function createNotificationsBatch(data: NotificationData[]) {
  try {
    const notifications = await prisma.notification.createMany({
      data: data.map((d) => ({
        userId: d.userId,
        title: d.title,
        message: d.message,
        type: d.type,
        entityType: d.entityType,
        entityId: d.entityId,
        actionType: d.actionType,
      })),
    })
    return { success: true, count: notifications.count }
  } catch (error) {
    console.error("Failed to create batch notifications:", error)
    return { success: false, error: "Failed to create batch notifications" }
  }
}

// ─── Task Notifications ──────────────────────────────────────────────────────

/**
 * Notify user when a task is assigned to them
 */
export async function notifyTaskAssigned(data: {
  userId: string
  taskId: string
  taskTitle: string
  clientName?: string
  assignedBy?: string
  dueDate?: Date
}) {
  return createNotification({
    userId: data.userId,
    title: "New Task Assigned",
    message: data.clientName
      ? `You've been assigned to "${data.taskTitle}" for ${data.clientName}${data.dueDate ? ` (Due: ${new Date(data.dueDate).toLocaleDateString()})` : ""}`
      : `You've been assigned to "${data.taskTitle}"${data.dueDate ? ` (Due: ${new Date(data.dueDate).toLocaleDateString()})` : ""}`,
    type: "TASK_ASSIGNED",
    entityType: "TASK",
    entityId: data.taskId,
    actionType: "ASSIGNED",
  })
}

/**
 * Notify user when a task is overdue
 */
export async function notifyTaskOverdue(data: {
  userId: string
  taskId: string
  taskTitle: string
  clientName?: string
  dueDate: Date
  daysOverdue: number
}) {
  return createNotification({
    userId: data.userId,
    title: "Task Overdue",
    message: data.clientName
      ? `"${data.taskTitle}" for ${data.clientName} is ${data.daysOverdue} day(s) overdue (Due: ${new Date(data.dueDate).toLocaleDateString()})`
      : `"${data.taskTitle}" is ${data.daysOverdue} day(s) overdue (Due: ${new Date(data.dueDate).toLocaleDateString()})`,
    type: "TASK_OVERDUE",
    entityType: "TASK",
    entityId: data.taskId,
    actionType: "OVERDUE",
  })
}

// ─── Compliance Notifications ────────────────────────────────────────────────

/**
 * Notify about upcoming compliance deadline
 */
export async function notifyComplianceDue(data: {
  userId: string
  complianceId: string
  complianceType: string
  clientName?: string
  dueDate: Date
  daysUntilDue: number
}) {
  const urgency = data.daysUntilDue <= 3 ? "URGENT: " : ""
  const timeText =
    data.daysUntilDue === 0
      ? "is due today"
      : data.daysUntilDue === 1
        ? "is due tomorrow"
        : `is due in ${data.daysUntilDue} days`

  return createNotification({
    userId: data.userId,
    title: `${urgency}Compliance Due: ${data.complianceType}`,
    message: data.clientName
      ? `${data.complianceType} for ${data.clientName} ${timeText} (${new Date(data.dueDate).toLocaleDateString()})`
      : `${data.complianceType} ${timeText} (${new Date(data.dueDate).toLocaleDateString()})`,
    type: "COMPLIANCE_DUE",
    entityType: "COMPLIANCE",
    entityId: data.complianceId,
    actionType: "DUE",
  })
}

// ─── Payment Notifications ───────────────────────────────────────────────────

/**
 * Notify about received payment
 */
export async function notifyPaymentReceived(data: {
  userId: string
  invoiceId: string
  invoiceNumber: string
  clientName: string
  amount: number
  paymentMethod?: string
}) {
  return createNotification({
    userId: data.userId,
    title: "Payment Received",
    message: `Received ₹${data.amount.toLocaleString("en-IN")} from ${data.clientName} for invoice #${data.invoiceNumber}${data.paymentMethod ? ` via ${data.paymentMethod}` : ""}`,
    type: "PAYMENT_RECEIVED",
    entityType: "PAYMENT",
    entityId: data.invoiceId,
    actionType: "RECEIVED",
  })
}

/**
 * Notify about overdue invoice
 */
export async function notifyInvoiceOverdue(data: {
  userId: string
  invoiceId: string
  invoiceNumber: string
  clientName: string
  amount: number
  dueDate: Date
  daysOverdue: number
}) {
  return createNotification({
    userId: data.userId,
    title: "Invoice Overdue",
    message: `Invoice #${data.invoiceNumber} for ${data.clientName} (₹${data.amount.toLocaleString("en-IN")}) is ${data.daysOverdue} day(s) overdue. Due date: ${new Date(data.dueDate).toLocaleDateString()}`,
    type: "INVOICE_OVERDUE",
    entityType: "INVOICE",
    entityId: data.invoiceId,
    actionType: "OVERDUE",
  })
}

// ─── Document Notifications ──────────────────────────────────────────────────

/**
 * Notify about uploaded document
 */
export async function notifyDocumentUploaded(data: {
  userId: string
  documentId: string
  documentTitle: string
  clientName?: string
  uploadedBy: string
  category?: string
}) {
  return createNotification({
    userId: data.userId,
    title: "Document Uploaded",
    message: data.clientName
      ? `${data.documentTitle} uploaded for ${data.clientName} by ${data.uploadedBy}${data.category ? ` (${data.category})` : ""}`
      : `${data.documentTitle} uploaded by ${data.uploadedBy}${data.category ? ` (${data.category})` : ""}`,
    type: "DOCUMENT_UPLOADED",
    entityType: "DOCUMENT",
    entityId: data.documentId,
    actionType: "UPLOADED",
  })
}

// ─── Generic Notifications ───────────────────────────────────────────────────

/**
 * Send a generic info notification
 */
export async function notifyInfo(data: {
  userId: string
  title: string
  message: string
  entityType?: NotificationEntityType
  entityId?: string
}) {
  return createNotification({
    userId: data.userId,
    title: data.title,
    message: data.message,
    type: "INFO",
    entityType: data.entityType,
    entityId: data.entityId,
  })
}

/**
 * Send a warning notification
 */
export async function notifyWarning(data: {
  userId: string
  title: string
  message: string
  entityType?: NotificationEntityType
  entityId?: string
}) {
  return createNotification({
    userId: data.userId,
    title: data.title,
    message: data.message,
    type: "WARNING",
    entityType: data.entityType,
    entityId: data.entityId,
  })
}

/**
 * Send an alert notification (high priority)
 */
export async function notifyAlert(data: {
  userId: string
  title: string
  message: string
  entityType?: NotificationEntityType
  entityId?: string
}) {
  return createNotification({
    userId: data.userId,
    title: data.title,
    message: data.message,
    type: "ALERT",
    entityType: data.entityType,
    entityId: data.entityId,
  })
}

// ─── System Notifications ────────────────────────────────────────────────────

/**
 * Notify all users with specific roles about a system event
 */
export async function notifyUsersByRole(data: {
  roles: string[]
  title: string
  message: string
  type: string
  entityType?: NotificationEntityType
  entityId?: string
}) {
  try {
    // Find all users with the specified roles
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: data.roles as any,
        },
      },
      select: { id: true },
    })

    if (users.length === 0) {
      return { success: true, count: 0 }
    }

    // Create notifications for all matching users
    const notifications = await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        title: data.title,
        message: data.message,
        type: data.type as any,
        entityType: data.entityType,
        entityId: data.entityId,
      })) as any,
    })

    return { success: true, count: notifications.count }
  } catch (error) {
    console.error("Failed to notify users by role:", error)
    return { success: false, error: "Failed to notify users" }
  }
}

/**
 * Notify all team members about an important update
 */
export async function notifyAllStaff(data: {
  title: string
  message: string
  type: string
  entityType?: NotificationEntityType
  entityId?: string
}) {
  return notifyUsersByRole({
    roles: ["PARTNER", "MANAGER", "EXECUTIVE"],
    ...data,
  })
}