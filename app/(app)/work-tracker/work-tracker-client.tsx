"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckSquare } from "lucide-react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { GlassCard } from "@/components/dashboard/glass-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskTable } from "@/components/work-tracker/task-table"
import { TaskDetailDrawer } from "@/components/work-tracker/task-detail-drawer"
import { TaskFilters } from "@/components/work-tracker/task-filters"
import { AddTaskDialog, type EditableTask } from "@/components/work-tracker/add-task-dialog"
import { AddInvoiceDialog } from "@/components/payments/add-invoice-dialog"
import { getTasksData, getTaskDetail, updateTaskStatus, acceptTask, declineTask, deleteTask, addComment, deleteComment, deleteAttachment } from "@/app/actions/tasks"
import { toast } from "sonner"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"

export function WorkTrackerClient() {
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string; gstin?: string | null }>>([])
  // Task→invoice popup: opens after a manager marks a task Filed/Done.
  const [invoicePrefill, setInvoicePrefill] = useState<{
    clientId: string
    serviceType?: string
    serviceDescription: string
    sourceTaskId: string
  } | null>(null)
  const [user, setUser] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Quick actions deep-link here with ?new=1 (&clientId=...) to open the dialog
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(
    () => searchParams.get("new") === "1"
  )
  const [initialClientId] = useState(() => searchParams.get("clientId") ?? undefined)
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
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
      setClients(clientsData.clients.map((c: any) => ({ id: c.id, name: c.name, gstin: c.gstin })))
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
        // Task completed by a manager → offer to raise an invoice for the work.
        const completed = tasks.find((t) => t.id === taskId)
        if (newStatus === "FILED_DONE" && canManage && completed?.client?.id) {
          setInvoicePrefill({
            clientId: completed.client.id,
            serviceType: completed.serviceType ?? undefined,
            serviceDescription: completed.title ?? "",
            sourceTaskId: taskId,
          })
        }
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

  const refreshSelected = (taskId: string) =>
    setTasks((freshTasks) => {
      const updated = freshTasks.find((t) => t.id === taskId)
      if (updated) setSelectedTask(updated)
      return freshTasks
    })

  const handleAccept = async (taskId: string) => {
    const result = await acceptTask(taskId)
    if (result.success) {
      toast.success("Task accepted — you can start working on it")
      await loadData()
      refreshSelected(taskId)
    } else {
      toast.error(result.error || "Failed to accept task")
    }
  }

  const handleDecline = async (taskId: string, reason: string) => {
    const result = await declineTask(taskId, reason)
    if (result.success) {
      toast.success("Task declined — a manager will reassign it")
      await loadData()
      refreshSelected(taskId)
    } else {
      toast.error(result.error || result.fieldErrors?.reason?.[0] || "Failed to decline task")
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

  const handleEditTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    setEditingTask({
      id: task.id,
      title: task.title,
      description: task.description,
      assignedEmployeeId: task.assignedEmployee?.id ?? task.assignedEmployeeId ?? null,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    })
  }

  const handleDeleteTaskConfirmed = async () => {
    if (!deletingTaskId) return
    const result = await deleteTask(deletingTaskId)
    if (result.success) {
      toast.success("Task deleted")
      if (selectedTask?.id === deletingTaskId) setDrawerOpen(false)
      await loadData()
    } else {
      toast.error(result.error || "Failed to delete task")
    }
  }

  const handleUploaded = async (taskId: string) => {
    await loadData()
    setTasks((freshTasks) => {
      const updated = freshTasks.find((t) => t.id === taskId)
      if (updated) setSelectedTask(updated)
      return freshTasks
    })
  }

  const canManage = user?.role === "PARTNER" || user?.role === "MANAGER"

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
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <TaskFilters
          onFiltersChange={handleFiltersChange}
          employees={employees}
        />
      </div>

      {/* Task View — table only */}
      {tasks.length === 0 ? (
        <GlassCard hover={false} className="p-12">
          <EmptyState
            icon={CheckSquare}
            title="No tasks found"
            description={
              canManage
                ? "Create your first task to start tracking filings and reviews"
                : "Tasks assigned to you by a Manager or Partner will appear here"
            }
            action={
              canManage
                ? {
                    label: "Create Task",
                    onClick: () => setAddTaskDialogOpen(true),
                  }
                : undefined
            }
          />
        </GlassCard>
      ) : (
        <TaskTable
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onEditTask={canManage ? handleEditTask : undefined}
          onDeleteTask={canManage ? setDeletingTaskId : undefined}
        />
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStatusChange={handleStatusChange}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onDeleteAttachment={handleDeleteAttachment}
        onUploaded={handleUploaded}
        currentUser={user}
        userNameMap={userNameMap}
      />

      {/* Add / Edit Task Dialog — management only (createTask/updateTask are P/M) */}
      <AddTaskDialog
        open={canManage && (addTaskDialogOpen || editingTask !== null)}
        onOpenChange={(open) => {
          if (!open) {
            setAddTaskDialogOpen(false)
            setEditingTask(null)
          }
        }}
        onSuccess={loadData}
        employees={employees}
        clients={clients}
        task={editingTask}
        initialClientId={initialClientId}
      />

      {/* Task→invoice popup — opens after a manager marks a task Filed/Done */}
      {invoicePrefill && (
        <AddInvoiceDialog
          open={invoicePrefill !== null}
          onOpenChange={(open) => !open && setInvoicePrefill(null)}
          onSuccess={() => setInvoicePrefill(null)}
          clients={clients}
          sourceTaskId={invoicePrefill.sourceTaskId}
          initialValues={{
            clientId: invoicePrefill.clientId,
            serviceType: invoicePrefill.serviceType ?? "",
            serviceDescription: invoicePrefill.serviceDescription,
          }}
        />
      )}

      <ConfirmDialog
        open={deletingTaskId !== null}
        onOpenChange={(open) => !open && setDeletingTaskId(null)}
        title="Delete this task?"
        description="The task, its comments, and attachments will be permanently removed. This cannot be undone."
        confirmLabel="Delete task"
        destructive
        onConfirm={handleDeleteTaskConfirmed}
      />
    </div>
  )
}
