"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { reportError } from "@/lib/observability/report-error"

/**
 * Route-group error boundary for /(client-portal)/* — client-facing pages.
 * Keeps the failure inside the client portal so clients never see staff UI
 * fragments on an error.
 */
export default function ClientPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [ref, setRef] = useState<string>("")
  useEffect(() => {
    setRef(reportError(error, { source: "client-portal-error-boundary", digest: error.digest }))
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-destructive/25 bg-destructive/5 p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold">Page unavailable</h1>
        <p className="mb-2 text-sm text-muted-foreground">
          We&apos;re having trouble loading this page right now. Please try again
          shortly, or contact your firm if it persists.
        </p>
        {ref && (
          <p className="mb-6 font-mono text-xs text-muted-foreground/70">
            Ref: {ref}
          </p>
        )}
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </Card>
    </div>
  )
}
