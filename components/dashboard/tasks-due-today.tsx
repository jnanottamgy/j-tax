"use client"

import Link from "next/link"
import { Circle, CircleCheck, AlertCircle } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { Badge } from "@/components/ui/badge"
import { SectionHeading } from "@/components/ui/section-heading"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  title: string
  priority: string
  dueDate: Date | null
  client: { name: string } | null
}

const priorityStyles: Record<string, string> = {
  URGENT: "border-red-500/20 bg-red-500/10 text-red-400",
  HIGH: "border-red-500/20 bg-red-500/10 text-red-400",
  MEDIUM: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  LOW: "border-white/10 bg-white/[0.04] text-muted-foreground",
}

function formatTime(date: Date | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export function TasksDueToday({ tasks }: { tasks: Task[] }) {
  const urgentCount = tasks.filter(
    (t) => t.priority === "URGENT" || t.priority === "HIGH"
  ).length

  return (
    <GlassCard className="flex h-full flex-col p-6" hover={false}>
      <SectionHeading
        title="Tasks Due Today"
        description={
          tasks.length === 0
            ? "No tasks due today"
            : `${tasks.length} item${tasks.length !== 1 ? "s" : ""} requiring attention`
        }
        action={
          <Badge
            variant="outline"
            className="border-white/[0.07] bg-white/[0.03] tabular-nums"
          >
            {urgentCount} urgent
          </Badge>
        }
      />

      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="text-center">
            <CircleCheck className="size-8 mx-auto text-emerald-400 mb-2" />
            <p className="text-sm text-muted-foreground">All clear for today</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-300 hover:bg-white/[0.04]"
            >
              <Link
                href="/work-tracker"
                className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                aria-label={`Go to task: ${task.title}`}
              >
                <Circle className="size-4 group-hover:hidden" />
                <CircleCheck className="hidden size-4 text-primary group-hover:block" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-snug">
                  {task.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {task.client?.name ?? "No client"}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 capitalize",
                  priorityStyles[task.priority] ?? priorityStyles.LOW
                )}
              >
                {task.priority.toLowerCase()}
              </Badge>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatTime(task.dueDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  )
}
