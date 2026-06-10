"use client"

import { useCallback, useEffect, useState } from "react"
import { LayoutGrid, Table, CheckSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/dashboard/glass-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { KanbanBoard } from "@/components/work-tracker/kanban-board"
import { TaskTable } from "@/components/work-tracker/task-table"
import { TaskDetailDrawer } from "@/components/work-tracker/task-detail-drawer"
import { TaskFilters } from "@/components/work-tracker/task-filters"
import { AddTaskDialog } from "@/components/work-tracker/add-task-dialog"
import { getTasksData, getTaskDetail, updateTaskStatus, addComment, deleteComment, deleteAttachment } from "@/app/actions/tasks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"

type ViewMode = "kanban" | "table"

export function WorkTrackerClient() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban")
  const [tasks, setTasks] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [user, setUser] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{
    status?: string
    priority?: string
    assignedEmployeeId?: string
    search?: string
    serviceType?: string
  }>({})

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTasksData(filters)
      setTasks(data.tasks)
      setEmployees(data.employees)
      setUser(data.user)
      
      // Fetch clients for task creation
      const { getClientsData } = await import("@/app/actions/clients")
      const clientsData = await getClientsData()
      setClients(clientsData.clients.map((c: any) => ({ id: c.id, name: c.name })))
    } catch (error) {
      console.error("Failed to load tasks:", error)
      toast.error("Failed to load tasks")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleTaskClick = async (taskId: string) => {
    try {
      const detail = await getTaskDetail(taskId)
      setSelectedTask(detail.task)
      setUserNameMap(detail.userNameMap)
      setDrawerOpen(true)
    } catch (error) {
      console.error("Failed to load task detail:", error)
      toast.error("Failed to load task details")
    }
  }

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const result = await updateTaskStatus(taskId, newStatus)
      if (result.success) {
        toast.success("Task status updated")
        await loadData()
        setTasks((freshTasks) => {
          const updated = freshTasks.find((t) => t.id === taskId)
          if (updated) setSelectedTask(updated)
          return freshTasks
        })
      } else {
        toast.error(result.error || "Failed to update status")
      }
    } catch (error) {
      console.error("Failed to update status:", error)
      toast.error("Failed to update status")
    }
  }

  const handleAddComment = async (taskId: string, content: string) => {
    try {
      const result = await addComment(taskId, content)
      if (result.success) {
        toast.success("Comment added")
        await loadData()
        // Fix: read from the freshly-loaded tasks state via a callback to avoid stale closure
        setTasks((freshTasks) => {
          const updated = freshTasks.find((t) => t.id === taskId)
          if (updated) setSelectedTask(updated)
          return freshTasks
        })
      } else if (result.fieldErrors?.content) {
        toast.error(result.fieldErrors.content[0] ?? "Comment is invalid")
      } else {
        toast.error(result.error || "Failed to add comment")
      }
    } catch (error) {
      console.error("Failed to add comment:", error)
      toast.error("Failed to add comment")
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      const result = await deleteComment(commentId)
      if (result.success) {
        toast.success("Comment deleted")
        await loadData()
      } else {
        toast.error(result.error || "Failed to delete comment")
      }
    } catch (error) {
      console.error("Failed to delete comment:", error)
      toast.error("Failed to delete comment")
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const result = await deleteAttachment(attachmentId)
      if (result.success) {
        toast.success("Attachment deleted")
        await loadData()
      } else {
        toast.error(result.error || "Failed to delete attachment")
      }
    } catch (error) {
      console.error("Failed to delete attachment:", error)
      toast.error("Failed to delete attachment")
    }
  }

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
  }

  const handleAddTask = (_status: TaskStatus) => {
    setAddTaskDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="h-96">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters and View Toggle */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <TaskFilters
          onFiltersChange={handleFiltersChange}
          employees={employees}
        />
        <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl p-1">
          <Button
            variant={viewMode === "kanban" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("kanban")}
            className={cn(
              "h-8 rounded-lg gap-2",
              viewMode === "kanban" && "btn-glow"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            className={cn(
              "h-8 rounded-lg gap-2",
              viewMode === "table" && "btn-glow"
            )}
          >
            <Table className="h-4 w-4" />
            Table
          </Button>
        </div>
      </div>

      {/* Task View */}
      {tasks.length === 0 ? (
        <GlassCard hover={false} className="p-12">
          <EmptyState
            icon={CheckSquare}
            title="No tasks found"
            description="Create your first task to start tracking filings and reviews"
            action={{
              label: "Create Task",
              onClick: () => setAddTaskDialogOpen(true),
            }}
          />
        </GlassCard>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onAddTask={handleAddTask}
        />
      ) : (
        <TaskTable
          tasks={tasks}
          onTaskClick={handleTaskClick}
        />
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStatusChange={handleStatusChange}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onDeleteAttachment={handleDeleteAttachment}
        currentUser={user}
        userNameMap={userNameMap}
      />

      {/* Add Task Dialog */}
      <AddTaskDialog
        open={addTaskDialogOpen}
        onOpenChange={setAddTaskDialogOpen}
        onSuccess={loadData}
        employees={employees}
        clients={clients}
      />
    </div>
  )
}
