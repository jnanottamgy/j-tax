/**
 * Next.js instrumentation — server-side observability entry point.
 *
 * `register()` runs once per server instance. This is where an external sink
 * (Sentry, OTel, Datadog) would be wired via setErrorSink(). None is bundled,
 * so by default errors are emitted as structured JSON lines (see report-error).
 *
 * `onRequestError` captures every server-side error Next.js sees — Server
 * Component renders, Route Handlers, and Server Actions — and routes them
 * through the same structured reporter the client error boundaries use.
 */
import type { Instrumentation } from "next"
import { reportError, setErrorSink } from "@/lib/observability/report-error"

export function register() {
  // Wire an external sink here when one is provisioned, e.g.:
  //   if (process.env.SENTRY_DSN) {
  //     const Sentry = await import("@sentry/nextjs")
  //     setErrorSink((err, ctx) => Sentry.captureException(err, { tags: ctx }))
  //   }
  // Left as a structured-logging no-op by default — nothing to configure.
  void setErrorSink
}

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  reportError(err, {
    source: `server:${context.routeType}`,
    severity: "error",
    extra: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routerKind: context.routerKind,
      renderSource: context.renderSource,
    },
  })
}
