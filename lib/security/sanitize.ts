export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return ""
  }
  
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
}

export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeInput(email)
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(sanitized) ? sanitized.toLowerCase() : ""
}

export function sanitizePhone(phone: string): string {
  const sanitized = sanitizeInput(phone)
  // Remove all non-digit characters
  return sanitized.replace(/\D/g, "")
}

export function sanitizeGSTIN(gstin: string): string {
  const sanitized = sanitizeInput(gstin).toUpperCase()
  // GSTIN format: 2 characters (state code) + 10 characters (PAN) + 3 characters (entity number) + 1 character (check digit)
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/
  return gstinRegex.test(sanitized) ? sanitized : ""
}

export function sanitizePAN(pan: string): string {
  const sanitized = sanitizeInput(pan).toUpperCase()
  // PAN format: 5 letters + 4 digits + 1 letter
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  return panRegex.test(sanitized) ? sanitized : ""
}

export function sanitizeUrl(url: string): string {
  const sanitized = sanitizeInput(url)
  try {
    const parsed = new URL(sanitized)
    // Only allow http and https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return ""
    }
    return sanitized
  } catch {
    return ""
  }
}

export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
}
