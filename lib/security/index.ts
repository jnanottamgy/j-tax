/**
 * Security Module for J-TACS
 * 
 * Central export for all security-related utilities.
 */

export {
  checkRateLimit,
  checkLoginRateLimit,
  checkApiRateLimit,
  checkActionRateLimit,
  resetRateLimit,
  getRateLimitHeaders,
  type RateLimitResult,
} from "./rate-limiter"

export {
  getSecurityHeaders,
  generateNonce,
  sanitizeHtml,
  escapeHtml,
  sanitizeFileName,
  validateFileExtension,
  type SecurityHeadersConfig,
} from "./security-headers"

export {
  logAuditEvent,
  logLoginSuccess,
  logLoginFailure,
  logLogout,
  logAccessDenied,
  logDataOperation,
  logSecurityEvent,
  getUserAuditLogs,
  checkSuspiciousActivity,
  AuditEventType,
  type AuditEvent,
} from "./audit-logger"