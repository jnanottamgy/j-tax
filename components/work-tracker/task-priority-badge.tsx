import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AlertTriangle, ArrowUp, Minus } from "lucide-react"

type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

const priorityConfig: Record<TaskPriority, { label: string; className: string; icon?: React.ReactNode }> = {
  LOW: {
    label: "Low",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20",
    icon: <Minus className="h-3 w-3" />,
  },
  MEDIUM: {
    label: "Medium",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20",
    icon: <ArrowUp className="h-3 w-3" />,
  },
  HIGH: {
    label: "High",
    className: "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20",
    icon: <ArrowUp className="h-3 w-3" />,
  },
  URGENT: {
    label: "Urgent",
    className: "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
}

interface TaskPriorityBadgeProps {
  priority: TaskPriority
  className?: string
}

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority]

  return (
    <Badge variant="outline" className={cn(config.className, "gap-1.5", className)}>
      {config.icon}
      {config.label}
    </Badge>
  )
}
