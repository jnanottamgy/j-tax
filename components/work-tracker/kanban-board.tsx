"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { MoreHorizontal, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TaskStatusBadge } from "./task-status-badge"
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

export function KanbanBoard({ tasks, onTaskClick, onStatusChange, onAddTask }: KanbanBoardProps) {
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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <motion.div
          key={column.id}
          layout
          className="flex-shrink-0 w-80"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(column.id)}
        >
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/50" />
                <h3 className="font-semibold text-sm">{column.title}</h3>
                <span className="text-xs text-muted-foreground bg-white/[0.04] px-2 py-0.5 rounded-full">
                  {column.tasks.length}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                onClick={() => onAddTask?.(column.id)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Task Cards */}
            <div className="p-3 space-y-2 min-h-[200px]">
              {column.tasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  draggable
                  onDragStart={() => handleDragStart(task)}
                  onDragEnd={handleDragEnd}
                  whileDrag={{ scale: 1.02, rotate: 1 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => onTaskClick?.(task.id)}
                  className={cn(
                    "bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 cursor-pointer",
                    "hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200",
                    draggedTask?.id === task.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h4 className="font-medium text-sm leading-tight flex-1">{task.title}</h4>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-white/[0.05] flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
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
                </motion.div>
              ))}

              {column.tasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
