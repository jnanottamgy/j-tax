import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Calendar, AlertCircle, Clock } from "lucide-react"
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns"

interface DueDateBadgeProps {
  dueDate: Date | null | undefined
  className?: string
}

export function DueDateBadge({ dueDate, className }: DueDateBadgeProps) {
  if (!dueDate) {
    return null
  }

  const isOverdue = isPast(dueDate) && !isToday(dueDate)
  const isTodayDue = isToday(dueDate)
  const isTomorrowDue = isTomorrow(dueDate)
  const daysUntil = differenceInDays(dueDate, new Date())
  const isDueSoon = daysUntil >= 0 && daysUntil <= 3

  if (isOverdue) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-red-500/10 text-red-400 border-red-500/20 gap-1.5",
          className
        )}
      >
        <AlertCircle className="h-3 w-3" />
        Overdue
      </Badge>
    )
  }

  if (isTodayDue) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-orange-500/10 text-orange-400 border-orange-500/20 gap-1.5",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Due Today
      </Badge>
    )
  }

  if (isTomorrowDue) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1.5",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Tomorrow
      </Badge>
    )
  }

  if (isDueSoon) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 gap-1.5",
          className
        )}
      >
        <Calendar className="h-3 w-3" />
        {daysUntil}d left
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-slate-500/10 text-slate-400 border-slate-500/20 gap-1.5",
        className
      )}
    >
      <Calendar className="h-3 w-3" />
      {format(dueDate, "MMM d")}
    </Badge>
  )
}
