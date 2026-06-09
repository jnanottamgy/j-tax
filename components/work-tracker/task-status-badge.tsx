import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  NOT_STARTED: {
    label: "Not Started",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
  },
  DATA_AWAITED: {
    label: "Data Awaited",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20",
  },
  FILED_DONE: {
    label: "Filed / Done",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20",
  },
  ON_HOLD: {
    label: "On Hold",
    className: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
  },
}

interface TaskStatusBadgeProps {
  status: TaskStatus
  className?: string
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
