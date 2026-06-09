import { prisma } from "@/lib/prisma"

export interface ActivityLogOptions {
  entityType: string
  entityId: string
  action: string
  description: string
  userId?: string
  userName?: string
  metadata?: any
}

// Log an activity
export async function logActivity(options: ActivityLogOptions): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        entityType: options.entityType,
        entityId: options.entityId,
        action: options.action,
        description: options.description,
        userId: options.userId,
        userName: options.userName,
        metadata: options.metadata || {},
      },
    })
  } catch (error) {
    console.error("Failed to log activity:", error)
    // Don't throw error to avoid breaking the main operation
  }
}

// Log client activity
export async function logClientActivity(
  clientId: string,
  action: string,
  description: string,
  userId?: string,
  userName?: string,
  metadata?: any
): Promise<void> {
  await logActivity({
    entityType: "CLIENT",
    entityId: clientId,
    action,
    description,
    userId,
    userName,
    metadata,
  })
}

// Log task activity
export async function logTaskActivity(
  taskId: string,
  action: string,
  description: string,
  userId?: string,
  userName?: string,
  metadata?: any
): Promise<void> {
  await logActivity({
    entityType: "TASK",
    entityId: taskId,
    action,
    description,
    userId,
    userName,
    metadata,
  })
}

// Log invoice activity
export async function logInvoiceActivity(
  invoiceId: string,
  action: string,
  description: string,
  userId?: string,
  userName?: string,
  metadata?: any
): Promise<void> {
  await logActivity({
    entityType: "INVOICE",
    entityId: invoiceId,
    action,
    description,
    userId,
    userName,
    metadata,
  })
}

// Log document activity
export async function logDocumentActivity(
  documentId: string,
  action: string,
  description: string,
  userId?: string,
  userName?: string,
  metadata?: any
): Promise<void> {
  await logActivity({
    entityType: "DOCUMENT",
    entityId: documentId,
    action,
    description,
    userId,
    userName,
    metadata,
  })
}

// Log employee activity
export async function logEmployeeActivity(
  employeeId: string,
  action: string,
  description: string,
  userId?: string,
  userName?: string,
  metadata?: any
): Promise<void> {
  await logActivity({
    entityType: "EMPLOYEE",
    entityId: employeeId,
    action,
    description,
    userId,
    userName,
    metadata,
  })
}

// Log compliance activity
export async function logComplianceActivity(
  complianceId: string,
  action: string,
  description: string,
  userId?: string,
  userName?: string,
  metadata?: any
): Promise<void> {
  await logActivity({
    entityType: "COMPLIANCE",
    entityId: complianceId,
    action,
    description,
    userId,
    userName,
    metadata,
  })
}

// Get activity logs for an entity
export async function getEntityActivityLogs(
  entityType: string,
  entityId: string,
  limit: number = 50
) {
  return await prisma.activityLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
  })
}

// Get activity logs for a user
export async function getUserActivityLogs(
  userId: string,
  limit: number = 50
) {
  return await prisma.activityLog.findMany({
    where: {
      userId,
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
  })
}

// Get global activity logs
export async function getGlobalActivityLogs(
  filters?: {
    entityType?: string
    userId?: string
    startDate?: Date
    endDate?: Date
  },
  limit: number = 100,
  offset: number = 0
) {
  const where: any = {}

  if (filters?.entityType) {
    where.entityType = filters.entityType
  }

  if (filters?.userId) {
    where.userId = filters.userId
  }

  if (filters?.startDate || filters?.endDate) {
    where.timestamp = {}
    if (filters.startDate) {
      where.timestamp.gte = filters.startDate
    }
    if (filters.endDate) {
      where.timestamp.lte = filters.endDate
    }
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: {
        timestamp: "desc",
      },
      take: limit,
      skip: offset,
    }),
    prisma.activityLog.count({ where }),
  ])

  return { logs, total }
}
