// Session timeout management for enhanced security

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes default
const WARNING_TIMEOUT_MS = 25 * 60 * 1000 // 5 minutes before timeout

export interface SessionInfo {
  userId: string
  userName: string
  lastActivity: number
  createdAt: number
}

const activeSessions = new Map<string, SessionInfo>()

export function createSession(userId: string, userName: string): SessionInfo {
  const now = Date.now()
  const session: SessionInfo = {
    userId,
    userName,
    lastActivity: now,
    createdAt: now,
  }
  
  activeSessions.set(userId, session)
  return session
}

export function updateSessionActivity(userId: string): void {
  const session = activeSessions.get(userId)
  if (session) {
    session.lastActivity = Date.now()
  }
}

export function getSession(userId: string): SessionInfo | undefined {
  return activeSessions.get(userId)
}

export function isSessionValid(userId: string): boolean {
  const session = activeSessions.get(userId)
  if (!session) return false
  
  const now = Date.now()
  const timeSinceActivity = now - session.lastActivity
  
  return timeSinceActivity < SESSION_TIMEOUT_MS
}

export function isSessionExpiringSoon(userId: string): boolean {
  const session = activeSessions.get(userId)
  if (!session) return false
  
  const now = Date.now()
  const timeSinceActivity = now - session.lastActivity
  
  return timeSinceActivity >= WARNING_TIMEOUT_MS && timeSinceActivity < SESSION_TIMEOUT_MS
}

export function getTimeUntilTimeout(userId: string): number {
  const session = activeSessions.get(userId)
  if (!session) return 0
  
  const now = Date.now()
  const timeSinceActivity = now - session.lastActivity
  const timeRemaining = SESSION_TIMEOUT_MS - timeSinceActivity
  
  return Math.max(0, timeRemaining)
}

export function terminateSession(userId: string): void {
  activeSessions.delete(userId)
}

export function terminateAllSessions(): void {
  activeSessions.clear()
}

// Clean up expired sessions periodically
export function cleanupExpiredSessions(): void {
  const now = Date.now()
  
  for (const [userId, session] of activeSessions.entries()) {
    const timeSinceActivity = now - session.lastActivity
    
    if (timeSinceActivity >= SESSION_TIMEOUT_MS) {
      activeSessions.delete(userId)
      console.log(`Session terminated for user ${userId} due to inactivity`)
    }
  }
}

// Start cleanup interval (run every 5 minutes)
if (typeof window === "undefined") {
  // Server-side cleanup
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
}

export function getSessionTimeoutConfig(): {
  timeout: number
  warning: number
} {
  return {
    timeout: SESSION_TIMEOUT_MS,
    warning: WARNING_TIMEOUT_MS,
  }
}
