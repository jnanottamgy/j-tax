import type { ZodError } from "zod"

/**
 * Maps internal errors to safe user-facing messages.
 * LOW-05: prevents Prisma constraint details and stack traces from reaching the client.
 */
export function toUserError(error: unknown): string {
  if (!(error instanceof Error)) return "An unexpected error occurred. Please try again."
  const msg = error.message
  if (msg.includes("Unique constraint") || msg.includes("unique constraint"))
    return "A record with that identifier already exists."
  if (msg.includes("Record to update not found") || msg.includes("P2025"))
    return "The record no longer exists."
  if (msg === "Unauthorized") return "You must be signed in to perform this action."
  if (msg.startsWith("Forbidden")) return "You do not have permission to perform this action."
  if (msg.includes("connect") || msg.includes("ECONNREFUSED"))
    return "Service temporarily unavailable. Please try again."
  return "An unexpected error occurred. Please try again."
}

/** First message per field from Zod flatten output. */
export function flattenFieldErrors(
  fieldErrors?: Record<string, string[] | undefined>
): Record<string, string> {
  if (!fieldErrors) return {}
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([, messages]) => messages && messages.length > 0)
      .map(([key, messages]) => [key, messages![0]!])
  )
}

/** First message per field from a ZodError. */
export function zodErrorToFieldMap(error: ZodError): Record<string, string> {
  return flattenFieldErrors(error.flatten().fieldErrors as Record<string, string[]>)
}

export function getFieldError(
  fieldErrors: Record<string, string> | undefined,
  field: string
): string | undefined {
  return fieldErrors?.[field]
}
