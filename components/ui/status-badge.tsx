import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
  CLIENT_STATUS_MEANING_FOR_BADGE,
  COMPLIANCE_STATUS_MEANING,
  INVOICE_STATUS_MEANING,
  TASK_STATUS_MEANING,
  statusMeaning,
} from "@/lib/status/consequences"

interface StatusBadgeProps {
  status: string
  icon?: LucideIcon
  className?: string
  /**
   * Which domain this status belongs to.
   *
   * Status strings collide across domains — PENDING is a client status and a
   * compliance status, OVERDUE is an invoice status and a compliance status —
   * so the consequence cannot be looked up from the string alone. Passing the
   * kind turns the chip from a colour into a statement of what the app will
   * and won't do. Omitted, the badge renders exactly as it always did.
   */
  kind?: "task" | "invoice" | "compliance" | "client"
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

const MEANING_BY_KIND = {
  task: TASK_STATUS_MEANING,
  invoice: INVOICE_STATUS_MEANING,
  compliance: COMPLIANCE_STATUS_MEANING,
  client: CLIENT_STATUS_MEANING_FOR_BADGE,
} as const

export function StatusBadge({ status, icon: Icon, className, kind }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "default" as const }
  const styles = variantStyles[config.variant]
  const meaning = kind ? statusMeaning(MEANING_BY_KIND[kind], status) : null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        styles,
        className
      )}
      title={meaning?.consequence}
    >
      {Icon && <Icon className="size-3" />}
      {config.label}
      {/* The statuses where the app stops doing something on its own. That is
          the difference worth seeing without hovering, because it is the one
          that turns into a missed deadline. */}
      {meaning && !meaning.automated && (
        <span
          aria-label="No automatic reminders in this status"
          className="inline-block size-1.5 rounded-full bg-current opacity-60"
        />
      )}
    </span>
  )
}
