import type { ClientPriority, ClientStatus } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import {
  CLIENT_PRIORITY_LABELS,
  CLIENT_STATUS_LABELS,
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
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", statusStyles[status])}
    >
      {CLIENT_STATUS_LABELS[status]}
    </Badge>
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
