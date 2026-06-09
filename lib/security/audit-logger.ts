/**
 * Audit Logging for J-TAX
 * 
 * Comprehensive audit logging for security events and user actions.
 * All security-relevant actions are logged for compliance and forensic analysis.
 */

import { prisma } from "@/lib/prisma"

export enum AuditEventType {
  // Authentication
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  LOGOUT = "LOGOUT",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  
  // Authorization
  ACCESS_GRANTED = "ACCESS_GRANTED",
  ACCESS_DENIED = "ACCESS_DENIED",
  PERMISSION_CHANGE = "PERMISSION_CHANGE",
  
  // Data Operations
  DATA_CREATE = "DATA_CREATE",
  DATA_READ = "DATA_READ",
  DATA_UPDATE = "DATA_UPDATE",
  DATA_DELETE = "DATA_DELETE",
  
  // File Operations
  FILE_UPLOAD = "FILE_UPLOAD",
  FILE_DOWNLOAD = "FILE_DOWNLOAD",
  FILE_DELETE = "FILE_DELETE",
  
  // Security Events
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  CSRF_TOKEN_INVALID = "CSRF_TOKEN_INVALID",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
  BRUTE_FORCE_ATTEMPT = "BRUTE_FORCE_ATTEMPT",
  
  // System
  CONFIG_CHANGE = "CONFIG_CHANGE",
  USER_CREATE = "USER_CREATE",
  USER_UPDATE = "USER_UPDATE",
  USER_DELETE = "USER_DELETE",
}

export interface AuditEvent {
  eventType: AuditEventType
  userId?: string
  userEmail?: string
  userRole?: string
  ipAddress?: string
  userAgent?: string
  resourceType?: string
  resourceId?: string
  action?: string
  details?: Record<string, unknown>
  success?: boolean
  errorMessage?: string
}

/**
 * Log an audit event
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType: event.eventType,
        userId: event.userId,
        userEmail: event.userEmail,
        userRole: event.userRole,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        action: event.action,
        details: event.details ? JSON.stringify(event.details) : null,
        success: event.success ?? true,
        errorMessage: event.errorMessage,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    // Don't fail the application if audit logging fails
    console.error("Failed to log audit event:", error)
  }
}

/**
 * Log authentication events
 */
export async function logLoginSuccess(userId: string, email: string, ip: string): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.LOGIN_SUCCESS,
    userId,
    userEmail: email,
    ipAddress: ip,
    success: true,
  })
}

export async function logLoginFailure(email: string, ip: string, reason?: string): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.LOGIN_FAILURE,
    userEmail: email,
    ipAddress: ip,
    success: false,
    errorMessage: reason,
  })
}

export async function logLogout(userId: string, ip: string): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.LOGOUT,
    userId,
    ipAddress: ip,
    success: true,
  })
}

/**
 * Log authorization events
 */
export async function logAccessDenied(
  userId: string,
  resource: string,
  requiredRole: string,
  ip: string
): Promise<void> {
  await logAuditEvent({
    eventType: AuditEventType.ACCESS_DENIED,
    userId,
    ipAddress: ip,
    resourceType: resource,
    action: `Required role: ${requiredRole}`,
    success: false,
  })
}

/**
 * Log data operations
 */
export async function logDataOperation(
  userId: string,
  eventType: AuditEventType,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>,
  ip?: string
): Promise<void> {
  await logAuditEvent({
    eventType,
    userId,
    ipAddress: ip,
    resourceType,
    resourceId,
    details,
    success: true,
  })
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  eventType: AuditEventType,
  details: {
    userId?: string
    ipAddress?: string
    reason?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  await logAuditEvent({
    eventType,
    userId: details.userId,
    ipAddress: details.ipAddress,
    details: details.metadata,
    success: false,
    errorMessage: details.reason,
  })
}

/**
 * Get recent audit logs for a user (for admin dashboard)
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 50
): Promise<AuditEvent[]> {
  const logs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    take: limit,
  })

  return logs.map((log) => ({
    eventType: log.eventType as AuditEventType,
    userId: log.userId ?? undefined,
    userEmail: log.userEmail ?? undefined,
    userRole: log.userRole ?? undefined,
    ipAddress: log.ipAddress ?? undefined,
    userAgent: log.userAgent ?? undefined,
    resourceType: log.resourceType ?? undefined,
    resourceId: log.resourceId ?? undefined,
    action: log.action ?? undefined,
    details: log.details ? JSON.parse(log.details) : undefined,
    success: log.success,
    errorMessage: log.errorMessage ?? undefined,
  }))
}

/**
 * Check for suspicious activity patterns
 */
export async function checkSuspiciousActivity(userId: string, ip: string): Promise<boolean> {
  const recentLogs = await prisma.auditLog.findMany({
    where: {
      OR: [{ userId }, { ipAddress: ip }],
      timestamp: {
        gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
      },
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  })

  // Check for multiple failed logins
  const failedLogins = recentLogs.filter(
    (log) => log.eventType === "LOGIN_FAILURE"
  ).length

  if (failedLogins >= 5) {
    await logSecurityEvent(AuditEventType.BRUTE_FORCE_ATTEMPT, {
      userId,
      ipAddress: ip,
      reason: `Multiple failed login attempts: ${failedLogins}`,
    })
    return true
  }

  // Check for access denied events
  const accessDenied = recentLogs.filter(
    (log) => log.eventType === "ACCESS_DENIED"
  ).length

  if (accessDenied >= 10) {
    await logSecurityEvent(AuditEventType.SUSPICIOUS_ACTIVITY, {
      userId,
      ipAddress: ip,
      reason: `Multiple access denied events: ${accessDenied}`,
    })
    return true
  }

  return false
}