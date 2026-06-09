import type { ZodError } from "zod"

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
