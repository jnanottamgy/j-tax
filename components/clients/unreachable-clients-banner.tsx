"use client"

/**
 * "These clients are not getting any of it."
 *
 * Every automated message the app sends a client goes by email: the welcome
 * mail, the seven-day compliance reminder, the invoice reminder, the portal
 * invitation. Every one of those send sites guards with `if (!client.email)`
 * and moves on — correct, because a nightly cron must not die on one bad row,
 * but completely silent. A client with no email address stops receiving
 * everything, and the first sign of it is a late fee the firm has to explain.
 *
 * The counts are what make this actionable. "No email" is a shrug; "no email
 * and four deadlines inside the next month" is somebody's Tuesday. Clients are
 * ordered by what is actually at stake, and the phone number is right there,
 * because the fix is a phone call.
 *
 * Renders nothing when every active client can be emailed.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { MailX } from "lucide-react"

import { getUnreachableClients, type UnreachableClient } from "@/app/actions/clients"

const MAX_LISTED = 6

export function UnreachableClientsBanner() {
  const [clients, setClients] = useState<UnreachableClient[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getUnreachableClients()
      .then((r) => { if (!cancelled) setClients(r) })
      .catch(() => { if (!cancelled) setClients([]) })
    return () => { cancelled = true }
  }, [])

  if (!clients || clients.length === 0) return null

  // Most at stake first — a client with deadlines coming is a different problem
  // from one whose record is merely incomplete.
  const ranked = [...clients].sort(
    (a, b) =>
      b.upcomingDeadlines - a.upcomingDeadlines ||
      b.openInvoices - a.openInvoices ||
      a.name.localeCompare(b.name)
  )
  const listed = ranked.slice(0, MAX_LISTED)
  const rest = ranked.length - listed.length

  const atRisk = ranked.filter((c) => c.upcomingDeadlines > 0 || c.openInvoices > 0).length

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-5 py-4">
      <MailX className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {ranked.length} active client{ranked.length === 1 ? " has" : "s have"} no email
            address.
          </span>{" "}
          Deadline reminders, invoice reminders and portal invitations are skipped for
          {ranked.length === 1 ? " them" : " them"} — nothing is sent and nothing is logged.
          {atRisk > 0 && (
            <>
              {" "}
              <span className="text-amber-400">
                {atRisk} {atRisk === 1 ? "has" : "have"} a deadline or an unpaid invoice
                waiting.
              </span>
            </>
          )}
        </p>

        <ul className="mt-3 flex flex-col gap-1.5">
          {listed.map((c) => {
            const stakes = [
              c.upcomingDeadlines > 0 &&
                `${c.upcomingDeadlines} deadline${c.upcomingDeadlines === 1 ? "" : "s"} in 30 days`,
              c.openInvoices > 0 &&
                `${c.openInvoices} unpaid invoice${c.openInvoices === 1 ? "" : "s"}`,
            ].filter(Boolean)

            return (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                <Link
                  href={`/clients/${c.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {c.name}
                </Link>
                {stakes.length > 0 && (
                  <span className="text-amber-400/90">{stakes.join(" · ")}</span>
                )}
                <span className="text-muted-foreground">
                  {c.phone ? `· call ${c.phone}` : "· no phone number either"}
                </span>
                {c.assignedEmployeeName && (
                  <span className="text-muted-foreground/70">· {c.assignedEmployeeName}</span>
                )}
              </li>
            )
          })}
        </ul>

        {rest > 0 && (
          <p className="mt-2 text-xs text-muted-foreground/70">
            and {rest} more.
          </p>
        )}
      </div>
    </div>
  )
}
