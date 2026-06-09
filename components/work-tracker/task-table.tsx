"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  completionDate: Date | null
  serviceType?: string | null
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

interface TaskTableProps {
  tasks: Task[]
  onTaskClick?: (taskId: string) => void
}

type SortField = "title" | "status" | "priority" | "dueDate" | "client"
type SortOrder = "asc" | "desc"

function SortIcon({ active }: { active: boolean }) {
  return (
    <ArrowUpDown
      className={cn(
        "ml-2 h-3 w-3 opacity-0 transition-opacity",
        active && "opacity-100"
      )}
    />
  )
}

export function TaskTable({ tasks, onTaskClick }: TaskTableProps) {
  const [sortField, setSortField] = useState<SortField>("dueDate")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0

    switch (sortField) {
      case "title":
        comparison = a.title.localeCompare(b.title)
        break
      case "status":
        comparison = a.status.localeCompare(b.status)
        break
      case "priority":
        const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
        break
      case "dueDate":
        if (!a.dueDate && !b.dueDate) comparison = 0
        else if (!a.dueDate) comparison = 1
        else if (!b.dueDate) comparison = -1
        else comparison = a.dueDate.getTime() - b.dueDate.getTime()
        break
      case "client":
        comparison = a.client.name.localeCompare(b.client.name)
        break
    }

    return sortOrder === "asc" ? comparison : -comparison
  })

  return (
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.08] hover:bg-transparent">
              <TableHead
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center">
                  Task
                  <SortIcon active={sortField === "title"} />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleSort("client")}
              >
                <div className="flex items-center">
                  Client
                  <SortIcon active={sortField === "client"} />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center">
                  Status
                  <SortIcon active={sortField === "status"} />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleSort("priority")}
              >
                <div className="flex items-center">
                  Priority
                  <SortIcon active={sortField === "priority"} />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleSort("dueDate")}
              >
                <div className="flex items-center">
                  Due Date
                  <SortIcon active={sortField === "dueDate"} />
                </div>
              </TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.map((task) => (
              <TableRow
                key={task.id}
                className="border-white/[0.08] hover:bg-white/[0.03] cursor-pointer transition-colors"
                onClick={() => onTaskClick?.(task.id)}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="text-sm">{task.title}</span>
                    {task.serviceType && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {task.serviceType.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{task.client.name}</TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status} />
                </TableCell>
                <TableCell>
                  <TaskPriorityBadge priority={task.priority} />
                </TableCell>
                <TableCell>
                  {task.dueDate ? <DueDateBadge dueDate={task.dueDate} /> : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell>
                  {task.assignedEmployee ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-[10px] font-medium">
                        {task.assignedEmployee.name.charAt(0)}
                      </div>
                      <span className="text-sm">{task.assignedEmployee.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {task._count.comments > 0 && (
                      <span>{task._count.comments} comments</span>
                    )}
                    {task._count.attachments > 0 && (
                      <span>{task._count.attachments} files</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sortedTasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No tasks found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
