/**
 * Centralised error reporting — dependency-free and Sentry-ready.
 *
 * Why this exists:
 *   The error boundaries used to carry a `// TODO: send to Sentry` comment and
 *   only `console.error`. That means production errors were invisible beyond
 *   raw Vercel logs with no structure, no correlation id, and no severity.
 *
 * What this does:
 *   - Emits a single structured JSON line per error (parseable by Vercel log
 *     drains / Datadog / Logtail without any SDK).
 *   - Generates a short correlation id returned to the caller so the UI can
 *     show "Ref: abcd1234" and support can grep for it.
 *   - If an upstream sink is wired (Sentry, etc.) via `setErrorSink`, forwards
 *     to it. No SDK is bundled, so there is zero cost when none is configured.
 *
 * Wiring a real sink later (e.g. @sentry/nextjs) is a one-liner in
 * instrumentation.ts:  setErrorSink((e, ctx) => Sentry.captureException(e, ...))
 */

export type ErrorSeverity = "fatal" | "error" | "warning"

export interface ErrorContext {
  /** Where it happened: route, action name, cron job, etc. */
  source?: string
  /** Authenticated user id, if known. Never log PII beyond the id. */
  userId?: string
  /** Role of the caller, if known. */
  role?: string
  /** Anything else useful for triage. Keep it small + non-sensitive. */
  extra?: Record<string, unknown>
  severity?: ErrorSeverity
  /** A digest/id from Next.js error boundaries, if present. */
  digest?: string
}

type ErrorSink = (error: unknown, context: ErrorContext & { eventId: string }) => void

let sink: ErrorSink | null = null

/**
 * Register an external sink (Sentry, Datadog, etc.). Call once at boot from
 * instrumentation.ts. Safe to never call — reporting still logs structured JSON.
 */
export function setErrorSink(fn: ErrorSink): void {
  sink = fn
}

function shortId(): string {
  // 8 hex chars — enough to correlate a single user-facing error.
  return Math.random().toString(16).slice(2, 10)
}

function serialiseError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack }
  }
  return { name: "NonError", message: String(error) }
}

/**
 * Report an error. Returns a correlation id the UI can surface to the user.
 * Never throws — reporting failures must not cascade.
 */
export function reportError(error: unknown, context: ErrorContext = {}): string {
  const eventId = context.digest || shortId()
  try {
    const payload = {
      ts: new Date().toISOString(),
      level: context.severity ?? "error",
      eventId,
      source: context.source ?? "unknown",
      userId: context.userId,
      role: context.role,
      err: serialiseError(error),
      extra: context.extra,
    }
    // Single structured line — greppable by eventId, parseable by log drains.
    console.error("[jtacs-error]", JSON.stringify(payload))
  } catch {
    // Last-resort: never let logging throw.
    console.error("[jtacs-error] (failed to serialise)", error)
  }

  if (sink) {
    try {
      sink(error, { ...context, eventId })
    } catch (sinkErr) {
      console.error("[jtacs-error] sink threw:", sinkErr)
    }
  }

  return eventId
}
