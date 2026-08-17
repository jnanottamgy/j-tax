import type { ZodError } from "zod"

import { reportError } from "@/lib/observability/report-error"

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
  if (msg === "FirmSuspended")
    return "This workspace is suspended. Please contact your provider to reactivate it."
  if (msg === "AmbiguousClientIdentity")
    return "This sign-in matches more than one client record, so we can't tell which account it is. Please contact your accountant."
  if (msg.startsWith("Forbidden")) return "You do not have permission to perform this action."
  if (msg.includes("connect") || msg.includes("ECONNREFUSED"))
    return "Service temporarily unavailable. Please try again."

  // Nothing above matched, so this is an error nobody anticipated — exactly the
  // kind worth keeping. Until now this line was the end of it: the message told
  // the user nothing and the error was never logged anywhere, so a failing
  // action left no trace on the server at all and could only be diagnosed by
  // guessing at the source. Log it, and hand back an id that can be found.
  const ref = reportError(error, { source: "toUserError", severity: "error" })
  return `Something went wrong on our side. Quote this to support: ${ref}`
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
