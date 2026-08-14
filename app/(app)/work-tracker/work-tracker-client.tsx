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
import { TaskFilters, type TaskFilterValues } from "@/components/work-tracker/task-filters"
import { ListEmptyState } from "@/components/ui/list-empty-state"
import {
  RecordFilingDialog,
  type FilingPrefill,
} from "@/components/work-tracker/record-filing-dialog"
import { financialYearOf } from "@/lib/india/format"
import { DUE_WINDOW_LABELS } from "@/lib/filters/due-window"
import { serviceLabel } from "@/lib/clients/constants"
import { AddTaskDialog, type EditableTask } from "@/components/work-tracker/add-task-dialog"
import { AddInvoiceDialog } from "@/components/payments/add-invoice-dialog"
import { getTasksData, getTaskDetail, updateTaskStatus, acceptTask, declineTask, deleteTask, addComment, deleteComment, deleteAttachment } from "@/app/actions/tasks"
import { ReasonPromptDialog } from "@/components/work-tracker/reason-prompt-dialog"
import { toast } from "sonner"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"

export function WorkTrackerClient() {
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string; gstin?: string | null }>>([])
  // Task→invoice popup: opens after a manager marks a task Filed/Done — but
  // only once the filing prompt has been answered, so the two never stack.
  type InvoicePrefill = {
    clientId: string
    serviceType?: string
    serviceDescription: string
    sourceTaskId: string
  }
  const [invoicePrefill, setInvoicePrefill] = useState<InvoicePrefill | null>(null)
  const [pendingInvoice, setPendingInvoice] = useState<InvoicePrefill | null>(null)
  // Task→filing capture: the acknowledgement number, asked while it is still
  // on screen rather than days later from the client's history tab.
  const [filingPrefill, setFilingPrefill] = useState<FilingPrefill | null>(null)
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
  const [filters, setFilters] = useState<TaskFilterValues>({})
  // Bumped to remount TaskFilters when filters are cleared from outside it.
  const [filtersKey, setFiltersKey] = useState(0)
  // Raised when a status change needs a written reason before it can go through.
  const [reasonPrompt, setReasonPrompt] = useState<{
    taskId: string
    status: TaskStatus
    message: string
  } | null>(null)
  const [reasonText, setReasonText] = useState("")

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

  // Deep link: /work-tracker?taskId=… opens that task's drawer.
  //
  // The dashboard queues and every task notification point here, and until now
  // the parameter was ignored — landing the user on an unfiltered list to hunt
  // for the row they had just clicked. Runs once per id so closing the drawer
  // doesn't immediately reopen it.
  const deepLinkTaskId = searchParams.get("taskId")
  const [openedDeepLink, setOpenedDeepLink] = useState<string | null>(null)
  useEffect(() => {
    if (!deepLinkTaskId || openedDeepLink === deepLinkTaskId) return
    setOpenedDeepLink(deepLinkTaskId)
    void handleTaskClick(deepLinkTaskId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkTaskId, openedDeepLink])

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus, reason?: string) => {
    try {
      const result = await updateTaskStatus(taskId, newStatus, reason)

      // Sending work back, or reopening something filed, has to say why — the
      // assignee only ever saw "check the task comments" with no comment in
      // them. The prompt is raised here rather than blocking with an error.
      const needsReason = result.fieldErrors?.reason?.[0]
      if (needsReason) {
        setReasonPrompt({ taskId, status: newStatus, message: needsReason })
        return
      }

      if (result.success) {
        toast.success("Task status updated")
        const completed = tasks.find((t) => t.id === taskId)
        if (newStatus === "FILED_DONE" && canManage && completed?.client?.id) {
          // Two things follow a completed filing: proof it happened, and a bill
          // for doing it. The acknowledgement number comes first because it is
          // the one that stops being available — it is on screen now, and in a
          // week it is buried in a portal. The invoice is held until the filing
          // prompt is answered so the two dialogs don't stack.
          setPendingInvoice({
            clientId: completed.client.id,
            serviceType: completed.serviceType ?? undefined,
            serviceDescription: completed.title ?? "",
            sourceTaskId: taskId,
          })
          setFilingPrefill({
            taskId,
            taskTitle: completed.title ?? "this task",
            clientName: completed.client.name ?? "",
            filingType: completed.serviceType
              ? serviceLabel(completed.serviceType as Parameters<typeof serviceLabel>[0])
              : "",
            financialYear: financialYearOf(
              completed.dueDate ? new Date(completed.dueDate) : new Date()
            ).short,
            period: "",
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

  const handleDecline = async (taskId: string, reason: string, reasonCode?: string) => {
    const result = await declineTask(taskId, reason, reasonCode)
    if (result.success) {
      // Declining now releases the task rather than leaving it sitting on the
      // decliner's board, blocked and still counted against their workload.
      toast.success("Declined — it's back in the unassigned queue")
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

  // Named for the empty state, so "no results" can say what is hiding them
  // rather than leaving someone to conclude their tasks are gone.
  const activeFilterLabels = [
    filters.status && `status “${filters.status.replace(/_/g, " ").toLowerCase()}”`,
    filters.priority && `priority “${filters.priority.toLowerCase()}”`,
    filters.assignedEmployeeId &&
      `assignee “${employees.find((e) => e.id === filters.assignedEmployeeId)?.name ?? "selected"}”`,
    filters.serviceType &&
      `service “${serviceLabel(filters.serviceType as Parameters<typeof serviceLabel>[0])}”`,
    filters.dueWindow && `due ${DUE_WINDOW_LABELS[filters.dueWindow].toLowerCase()}`,
    filters.search && `search “${filters.search}”`,
  ].filter(Boolean) as string[]

  // TaskFilters keeps its own control state, so clearing from out here has to
  // remount it — otherwise the dropdowns keep showing filters that no longer
  // apply.
  const handleClearFilters = () => {
    setFilters({})
    setFiltersKey((k) => k + 1)
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
          key={filtersKey}
          onFiltersChange={handleFiltersChange}
          employees={employees}
        />
      </div>

      {/* Task View — table only */}
      {tasks.length === 0 ? (
        <GlassCard hover={false} className="p-12">
          {/* The list is filtered on the server, so an empty result says nothing
              about whether any tasks exist. It used to answer "create your first
              task" to someone holding two hundred of them behind a status
              filter. The filters themselves are the only way to tell. */}
          <ListEmptyState
            icon={CheckSquare}
            filtered={activeFilterLabels.length > 0}
            noun="tasks"
            emptyHint={
              canManage
                ? "Tasks are the unit of work in the firm — create one to start tracking a filing or a review."
                : "Tasks assigned to you by a Manager or Partner will appear here."
            }
            activeFilters={activeFilterLabels}
            onClearFilters={handleClearFilters}
            action={
              canManage
                ? { label: "Create Task", onClick: () => setAddTaskDialogOpen(true) }
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

      <ReasonPromptDialog
        open={reasonPrompt !== null}
        message={reasonPrompt?.message ?? ""}
        value={reasonText}
        onChange={setReasonText}
        onCancel={() => {
          setReasonPrompt(null)
          setReasonText("")
        }}
        onSubmit={() => {
          const prompt = reasonPrompt
          const text = reasonText.trim()
          setReasonPrompt(null)
          setReasonText("")
          if (prompt && text) void handleStatusChange(prompt.taskId, prompt.status, text)
        }}
      />

      {/* Filing capture — asked first, because the ARN is on screen now and
          buried in a portal by next week. Answering or skipping it releases the
          invoice prompt behind it. */}
      <RecordFilingDialog
        prefill={filingPrefill}
        open={filingPrefill !== null}
        onOpenChange={(open) => !open && setFilingPrefill(null)}
        onDone={() => {
          setFilingPrefill(null)
          setInvoicePrefill(pendingInvoice)
          setPendingInvoice(null)
        }}
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
