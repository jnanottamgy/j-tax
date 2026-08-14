import type { ClientPriority, ClientStatus } from "@prisma/client"
import { MailX } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { clientReachability, reachabilityBadgeLabel } from "@/lib/clients/reachability"
import { resolveGstRegistration } from "@/lib/clients/gst-registration"
import {
  CLIENT_PRIORITY_LABELS,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_MEANING,
} from "@/lib/clients/constants"
import { cn } from "@/lib/utils"

const statusStyles: Record<ClientStatus, string> = {
  ACTIVE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  INACTIVE: "border-white/10 bg-white/[0.04] text-muted-foreground",
  PENDING: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  ON_HOLD: "border-sky-500/25 bg-sky-500/10 text-sky-400",
}

const priorityStyles: Record<ClientPriority, string> = {
  LOW: "border-white/10 bg-white/[0.04] text-muted-foreground",
  MEDIUM: "border-primary/25 bg-primary/10 text-primary",
  HIGH: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  CRITICAL: "border-red-500/25 bg-red-500/10 text-red-400",
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const meaning = CLIENT_STATUS_MEANING[status]
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", statusStyles[status])}
      // The chip said "Pending" and nothing else, so three of the four statuses
      // silently switched off automatic compliance with no way to tell.
      title={meaning.consequence}
    >
      {CLIENT_STATUS_LABELS[status]}
      {!meaning.generatesFilings && (
        <span
          aria-label="No automatic filings"
          className="ml-1.5 inline-block size-1.5 rounded-full bg-current opacity-60"
        />
      )}
    </Badge>
  )
}

/**
 * "We can't email this client."
 *
 * Every automated message the app sends a client goes by email, and every send
 * site skips a client without one. The skip is correct; the silence was not.
 * This is the marker that turns an empty column into a visible fact wherever a
 * client's name appears.
 *
 * Renders nothing when the client can be emailed, so a firm with tidy records
 * never sees it.
 */
export function ClientReachabilityBadge({
  client,
}: {
  client: { email?: string | null; phone?: string | null; whatsapp?: string | null }
}) {
  const reach = clientReachability(client)
  const label = reachabilityBadgeLabel(reach)
  if (!label || !reach.gap) return null

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        reach.isReachable
          ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
          : "border-red-500/25 bg-red-500/10 text-red-400"
      )}
      title={reach.gap}
    >
      <MailX className="mr-1 size-3" aria-hidden />
      {label}
    </Badge>
  )
}

/**
 * What sits in the GSTIN column when there is no GSTIN.
 *
 * A bare dash covered two different situations — a genuine B2C client, and one
 * whose GSTIN nobody has collected — and only the second one costs anything.
 * Naming them apart is the whole point of storing the answer.
 */
export function GstRegistrationHint({
  gstRegistration,
}: {
  gstRegistration: string | null | undefined
}) {
  const { status, reason } = resolveGstRegistration({ gstin: null, gstRegistration })

  if (status === "UNREGISTERED") {
    return (
      <span className="font-sans text-muted-foreground" title={reason}>
        Not registered
      </span>
    )
  }

  return (
    <span className="font-sans text-amber-400/80" title={reason}>
      Not on record
    </span>
  )
}

export function ClientPriorityBadge({ priority }: { priority: ClientPriority }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", priorityStyles[priority])}
    >
      {CLIENT_PRIORITY_LABELS[priority]}
    </Badge>
  )
}
