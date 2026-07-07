import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatusBadgeProps {
  status: string
  icon?: LucideIcon
  className?: string
}

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" }> = {
  // Task Status
  NOT_STARTED: { label: "Not Started", variant: "default" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  DATA_AWAITED: { label: "Data Awaited", variant: "warning" },
  UNDER_REVIEW: { label: "Under Review", variant: "warning" },
  FILED_DONE: { label: "Filed", variant: "success" },
  ON_HOLD: { label: "On Hold", variant: "destructive" },
  
  // Client Status
  ACTIVE: { label: "Active", variant: "success" },
  INACTIVE: { label: "Inactive", variant: "default" },
  PENDING: { label: "Pending", variant: "warning" },
  
  // Invoice Status
  DRAFT: { label: "Draft", variant: "default" },
  SENT: { label: "Sent", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
  PARTIALLY_PAID: { label: "Partially Paid", variant: "warning" },
  OVERDUE: { label: "Overdue", variant: "destructive" },
  DISPUTED: { label: "Disputed", variant: "destructive" },
  WAIVED: { label: "Waived", variant: "default" },
  
  // Compliance Status
  SCHEDULED: { label: "Scheduled", variant: "default" },
  DUE: { label: "Due", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "default" },
  
  // Message Status
  QUEUED: { label: "Queued", variant: "warning" },
  DELIVERED: { label: "Delivered", variant: "success" },
  READ: { label: "Read", variant: "success" },
  FAILED: { label: "Failed", variant: "destructive" },
  RETRYING: { label: "Retrying", variant: "warning" },
}

// Lighter -300/-400 foregrounds + slightly stronger fills so small uppercase
// badge text clears WCAG AA on the dark theme (the old -500 on 10% failed).
const variantStyles = {
  default: "bg-muted/60 text-foreground/90 border-white/15",
  success: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  warning: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  destructive: "bg-red-500/12 text-red-300 border-red-500/25",
}

export function StatusBadge({ status, icon: Icon, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "default" as const }
  const styles = variantStyles[config.variant]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        styles,
        className
      )}
    >
      {Icon && <Icon className="size-3" />}
      {config.label}
    </span>
  )
}
