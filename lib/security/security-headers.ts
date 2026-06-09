/**
 * Security Headers for J-TAX
 * 
 * Implements comprehensive security headers for protection against
 * XSS, clickjacking, MIME sniffing, and other attacks.
 */

export interface SecurityHeadersConfig {
  isDev: boolean
  domain: string
}

export function getSecurityHeaders(config: SecurityHeadersConfig): Record<string, string> {
  const { isDev, domain } = config

  const headers: Record<string, string> = {
    // CSP - Content Security Policy
    'Content-Security-Policy': getContentSecurityPolicy(isDev, domain),

    // XSS Protection
    'X-XSS-Protection': '1; mode=block',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Clickjacking protection
    'X-Frame-Options': 'DENY',

    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions Policy
    'Permissions-Policy': getPermissionsPolicy(),

    // HSTS - HTTP Strict Transport Security
    'Strict-Transport-Security': isDev
      ? ''
      : 'max-age=31536000; includeSubDomains; preload',

    // Cross-Origin policies
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',

    // Cache control for sensitive data
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }

  // Remove empty headers
  return Object.fromEntries(
    Object.entries(headers).filter(([_, value]) => value !== '')
  )
}

function getContentSecurityPolicy(isDev: boolean, domain: string): string {
  const directives = {
    'default-src': ["'self'"],
    'script-src': isDev
      ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"]
      : ["'self'", "'nonce-{nonce}'"],
    'style-src': ["'self'", "'unsafe-inline'"], // Required for many UI libraries
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      isDev ? 'ws://localhost:*' : '',
    ].filter(Boolean),
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': isDev ? [] : [''],
  }

  return Object.entries(directives)
    .filter(([_, values]) => values.length > 0)
    .map(([directive, values]) => `${directive} ${values.filter(Boolean).join(' ')}`)
    .join('; ')
}

function getPermissionsPolicy(): string {
  return [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'accelerometer=()',
    'gyroscope=()',
  ].join(', ')
}

/**
 * Generate nonce for inline scripts (for CSP)
 */
export function generateNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  // In production, use a library like DOMPurify
  // This is a basic implementation
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!\/?>)<[^<]*)*\/?>/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Validate and sanitize file names to prevent path traversal
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path separators and dangerous characters
  return fileName
    .replace(/[\\/]/g, '-')
    .replace(/\.\./g, '')
    .replace(/[^\w.-]/g, '_')
    .substring(0, 255) // Limit length
}

/**
 * Validate file extension against allowed types
 */
export function validateFileExtension(fileName: string, allowed: string[]): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext ? allowed.includes(ext) : false
}