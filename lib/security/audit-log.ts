// Audit logging for security events and user actions

export interface AuditLogEntry {
  id: string
  userId: string
  userName: string
  action: string
  entityType: string
  entityId: string
  description: string
  ipAddress?: string
  userAgent?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface SecurityEvent {
  type: "LOGIN" | "LOGOUT" | "FAILED_LOGIN" | "PASSWORD_CHANGE" | "ROLE_CHANGE" | "PERMISSION_DENIED" | "DATA_ACCESS" | "DATA_MODIFICATION"
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  userId: string
  userName: string
  details: Record<string, any>
  timestamp: Date
}

const auditLog: AuditLogEntry[] = []
const securityEvents: SecurityEvent[] = []

export function logAuditEvent(entry: Omit<AuditLogEntry, "id" | "timestamp">): void {
  const logEntry: AuditLogEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  }
  
  auditLog.push(logEntry)
  
  // In production, this would be sent to a logging service (e.g., Sentry, LogRocket, CloudWatch)
  console.log("AUDIT LOG:", logEntry)
}

export function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">): void {
  const securityEvent: SecurityEvent = {
    ...event,
    timestamp: new Date(),
  }
  
  securityEvents.push(securityEvent)
  
  // In production, critical events should trigger alerts
  if (event.severity === "CRITICAL" || event.severity === "HIGH") {
    console.error("SECURITY ALERT:", securityEvent)
    // TODO: Send to security monitoring service
  } else {
    console.log("SECURITY EVENT:", securityEvent)
  }
}

export function getAuditLogs(userId?: string, limit: number = 100): AuditLogEntry[] {
  let logs = auditLog
  
  if (userId) {
    logs = logs.filter(log => log.userId === userId)
  }
  
  return logs
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

export function getSecurityEvents(limit: number = 100): SecurityEvent[] {
  return securityEvents
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

export function getSecurityEventsByUser(userId: string, limit: number = 100): SecurityEvent[] {
  return securityEvents
    .filter(event => event.userId === userId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
}

// Helper functions for common audit events
export function logLogin(userId: string, userName: string, ipAddress?: string, userAgent?: string): void {
  logAuditEvent({
    userId,
    userName,
    action: "LOGIN",
    entityType: "USER",
    entityId: userId,
    description: "User logged in",
    ipAddress,
    userAgent,
  })
  
  logSecurityEvent({
    type: "LOGIN",
    severity: "LOW",
    userId,
    userName,
    details: { ipAddress, userAgent },
  })
}

export function logLogout(userId: string, userName: string): void {
  logAuditEvent({
    userId,
    userName,
    action: "LOGOUT",
    entityType: "USER",
    entityId: userId,
    description: "User logged out",
  })
  
  logSecurityEvent({
    type: "LOGOUT",
    severity: "LOW",
    userId,
    userName,
    details: {},
  })
}

export function logFailedLogin(email: string, ipAddress?: string, userAgent?: string): void {
  logSecurityEvent({
    type: "FAILED_LOGIN",
    severity: "MEDIUM",
    userId: email,
    userName: email,
    details: { ipAddress, userAgent },
  })
}

export function logDataAccess(
  userId: string,
  userName: string,
  entityType: string,
  entityId: string,
  action: string
): void {
  logAuditEvent({
    userId,
    userName,
    action,
    entityType,
    entityId,
    description: `User accessed ${entityType} ${entityId}`,
  })
  
  logSecurityEvent({
    type: "DATA_ACCESS",
    severity: "LOW",
    userId,
    userName,
    details: { entityType, entityId, action },
  })
}

export function logDataModification(
  userId: string,
  userName: string,
  entityType: string,
  entityId: string,
  action: string,
  previousState?: any,
  newState?: any
): void {
  logAuditEvent({
    userId,
    userName,
    action,
    entityType,
    entityId,
    description: `User modified ${entityType} ${entityId}`,
    metadata: {
      previousState,
      newState,
    },
  })
  
  logSecurityEvent({
    type: "DATA_MODIFICATION",
    severity: "MEDIUM",
    userId,
    userName,
    details: { entityType, entityId, action },
  })
}

export function logPermissionDenied(
  userId: string,
  userName: string,
  action: string,
  resource: string
): void {
  logAuditEvent({
    userId,
    userName,
    action: "PERMISSION_DENIED",
    entityType: "USER",
    entityId: userId,
    description: `User denied access to ${resource}`,
    metadata: { attemptedAction: action, resource },
  })
  
  logSecurityEvent({
    type: "PERMISSION_DENIED",
    severity: "MEDIUM",
    userId,
    userName,
    details: { action, resource },
  })
}

export function logRoleChange(
  userId: string,
  userName: string,
  previousRole: string,
  newRole: string,
  changedBy: string,
  changedByName: string
): void {
  logAuditEvent({
    userId,
    userName,
    action: "ROLE_CHANGE",
    entityType: "USER",
    entityId: userId,
    description: `User role changed from ${previousRole} to ${newRole}`,
    metadata: {
      previousRole,
      newRole,
      changedBy,
      changedByName,
    },
  })
  
  logSecurityEvent({
    type: "ROLE_CHANGE",
    severity: "HIGH",
    userId,
    userName,
    details: { previousRole, newRole, changedBy, changedByName },
  })
}
