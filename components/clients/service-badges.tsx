import type { ServiceFrequency, ServiceType } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import {
  SERVICE_FREQUENCY_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/clients/constants"
import { cn } from "@/lib/utils"

export function ServiceBadge({
  type,
  frequency,
  className,
}: {
  type: ServiceType
  frequency?: ServiceFrequency
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-white/[0.07] bg-white/[0.03] text-[11px] font-normal text-muted-foreground",
        className
      )}
    >
      {SERVICE_TYPE_LABELS[type]}
      {frequency && (
        <span className="text-muted-foreground/60">
          {" · "}
          {SERVICE_FREQUENCY_LABELS[frequency]}
        </span>
      )}
    </Badge>
  )
}

export function ServiceBadgeList({
  services,
  max = 2,
}: {
  services: { type: ServiceType; frequency: ServiceFrequency }[]
  max?: number
}) {
  const visible = services.slice(0, max)
  const remaining = services.length - max

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((s) => (
        <ServiceBadge key={s.type} type={s.type} frequency={s.frequency} />
      ))}
      {remaining > 0 && (
        <Badge
          variant="outline"
          className="border-white/[0.07] bg-white/[0.03] text-[11px] text-muted-foreground"
        >
          +{remaining}
        </Badge>
      )}
    </div>
  )
}
