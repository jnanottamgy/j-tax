"use client"

import { useState } from "react"
import { Eye, Lock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TaskPriorityBadge } from "./task-priority-badge"
import { DueDateBadge } from "./due-date-badge"
import { cn } from "@/lib/utils"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"

interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  dueDate: Date | null
  client: {
    id: string
    name: string
  }
  assignedEmployee?: {
    id: string
    name: string
  } | null
  blockedBy?: Array<{ blocker: { id: string; title: string; status: string } }>
  _count: {
    comments: number
    attachments: number
  }
}

interface KanbanColumn {
  id: TaskStatus
  title: string
  tasks: Task[]
}

interface KanbanBoardProps {
  tasks: Task[]
  onTaskClick?: (taskId: string) => void
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
  onAddTask?: (status: TaskStatus) => void
  onEditTask?: (taskId: string) => void
  /** Only passed for PARTNER/MANAGER — hides the delete item otherwise */
  onDeleteTask?: (taskId: string) => void
}

const COLUMNS: TaskStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DATA_AWAITED",
  "UNDER_REVIEW",
  "FILED_DONE",
  "ON_HOLD",
]

const COLUMN_TITLES: Record<TaskStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  DATA_AWAITED: "Data Awaited",
  UNDER_REVIEW: "Under Review",
  FILED_DONE: "Filed / Done",
  ON_HOLD: "On Hold",
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  onStatusChange,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  const columns: KanbanColumn[] = COLUMNS.map((status) => ({
    id: status,
    title: COLUMN_TITLES[status],
    tasks: tasks.filter((task) => task.status === status),
  }))

  const handleDragStart = (task: Task) => {
    setDraggedTask(task)
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
  }

  const handleDrop = (targetStatus: TaskStatus) => {
    if (draggedTask && draggedTask.status !== targetStatus) {
      onStatusChange?.(draggedTask.id, targetStatus)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-16rem)] min-h-[420px] items-stretch">
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex-shrink-0 w-80 flex flex-col"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(column.id)}
        >
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            {/* Column Header */}
            <div className="shrink-0 px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/50" />
                <h3 className="font-semibold text-sm">{column.title}</h3>
                <span className="text-xs text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded-full">
                  {column.tasks.length}
                </span>
              </div>
              {onAddTask && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  onClick={() => onAddTask(column.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Task Cards — scrolls internally so one busy column can't stretch the board */}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onTaskClick?.(task.id)}
                  className={cn(
                    "bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 cursor-pointer",
                    "hover:bg-white/[0.05] hover:border-white/[0.12] transition-colors duration-200",
                    draggedTask?.id === task.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-medium text-sm leading-tight flex-1">{task.title}</h4>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-white/[0.05] flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Actions for ${task.title}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onSelect={() => onTaskClick?.(task.id)}>
                          <Eye className="size-3.5" />
                          View details
                        </DropdownMenuItem>
                        {onEditTask && (
                          <DropdownMenuItem onSelect={() => onEditTask(task.id)}>
                            <Pencil className="size-3.5" />
                            Edit task
                          </DropdownMenuItem>
                        )}
                        {onDeleteTask && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              onSelect={() => onDeleteTask(task.id)}
                            >
                              <Trash2 className="size-3.5" />
                              Delete task
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    {/* Client */}
                    <div className="text-xs text-muted-foreground truncate">
                      {task.client.name}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      <TaskPriorityBadge priority={task.priority} />
                      {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
                      {(task.blockedBy ?? []).some((d) => d.blocker.status !== "FILED_DONE") && (
                        <span
                          title={`Waiting on: ${(task.blockedBy ?? [])
                            .filter((d) => d.blocker.status !== "FILED_DONE")
                            .map((d) => d.blocker.title)
                            .join(", ")}`}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-400"
                        >
                          <Lock className="h-3 w-3" /> Blocked
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                      {task.assignedEmployee && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-[10px] font-medium">
                            {task.assignedEmployee.name.charAt(0)}
                          </div>
                          <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                            {task.assignedEmployee.name}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task._count.comments > 0 && (
                          <span>{task._count.comments} comments</span>
                        )}
                        {task._count.attachments > 0 && (
                          <span>{task._count.attachments} files</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {column.tasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
