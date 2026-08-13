"use client"

/**
 * "These clients are not getting filings generated."
 *
 * The recurring engine only serves clients with status ACTIVE. That was a
 * silent exclusion — a client on any other status just never appeared in the
 * monthly job, so the calendar looked healthy while a whole cohort was getting
 * nothing. The gap now announces itself on the page where someone is already
 * looking at compliance, with the repair one click away.
 *
 * Renders nothing when every client with active services is covered, so a
 * healthy firm never sees it.
 */

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  activateClientsForCompliance,
  getComplianceCoverageGaps,
  type ExcludedClient,
} from "@/app/actions/compliance"

const STATUS_REASON: Record<string, string> = {
  PENDING: "never activated",
  ON_HOLD: "on hold",
  INACTIVE: "marked inactive",
}

export function CoverageGapBanner() {
  const router = useRouter()
  const [gaps, setGaps] = useState<ExcludedClient[] | null>(null)
  const [done, setDone] = useState<{ activated: number; events: number } | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getComplianceCoverageGaps()
      .then((r) => { if (!cancelled) setGaps(r) })
      .catch(() => { if (!cancelled) setGaps([]) })
    return () => { cancelled = true }
  }, [])

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-5 py-4">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {done.activated} client{done.activated === 1 ? "" : "s"} activated.
          </span>{" "}
          {done.events > 0
            ? `${done.events} missed filing${done.events === 1 ? "" : "s"} have been added to the calendar, and they'll be topped up automatically from now on.`
            : "They're in the compliance engine now and will be topped up automatically each month."}
        </p>
      </div>
    )
  }

  if (!gaps || gaps.length === 0) return null

  const onlyPending = gaps.every((g) => g.status === "PENDING")

  function handleActivate() {
    setError("")
    startTransition(async () => {
      const result = await activateClientsForCompliance((gaps ?? []).map((g) => g.id))
      if (!result.success) {
        setError(result.error ?? "Could not activate those clients.")
        return
      }
      setDone({ activated: result.activated, events: result.eventsCreated })
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {gaps.length} client{gaps.length === 1 ? " is" : "s are"} not receiving automatic
              filings
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {onlyPending
                ? "They have active services but were never activated, so the monthly compliance run skips them — no GST, TDS or ITR deadlines are being created."
                : "They have active services but their status keeps them out of the monthly compliance run, so no deadlines are being created for them."}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {gaps.slice(0, 8).map((g) => (
                <li key={g.id} className="text-xs text-muted-foreground">
                  <span className="text-foreground">{g.name}</span>{" "}
                  <span className="text-muted-foreground/70">
                    · {g.serviceCount} service{g.serviceCount === 1 ? "" : "s"} ·{" "}
                    {STATUS_REASON[g.status] ?? g.status.toLowerCase()}
                  </span>
                </li>
              ))}
              {gaps.length > 8 && (
                <li className="text-xs text-muted-foreground/70">
                  and {gaps.length - 8} more
                </li>
              )}
            </ul>
            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
          </div>
        </div>
        <Button onClick={handleActivate} disabled={pending} className="shrink-0 gap-2">
          {pending && <Loader2 className="size-4 animate-spin" />}
          Activate {gaps.length === 1 ? "client" : "all"}
        </Button>
      </div>
    </div>
  )
}
