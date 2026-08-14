"use client"

import { useState } from "react"
import { format } from "date-fns"
import { X, MessageSquare, Paperclip, Clock, User, Building2, Save, Trash2, Upload, Loader2, Lock } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TaskStatusBadge, TaskAcceptanceBadge } from "./task-status-badge"
import { TaskPriorityBadge } from "./task-priority-badge"
import { DueDateBadge } from "./due-date-badge"
import { TaskTimer } from "./task-timer"
import { TaskDependencies } from "./task-dependencies"
import { addAttachment } from "@/app/actions/tasks"
import { uploadFile } from "@/lib/storage/storage"
import { daysWorkedSince } from "@/lib/time/format"
import { cn } from "@/lib/utils"
import { DECLINE_REASONS } from "@/lib/tasks/transitions"
import { toast } from "sonner"

type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DATA_AWAITED" | "UNDER_REVIEW" | "FILED_DONE" | "ON_HOLD"

interface TaskComment {
  id: string
  content: string
  userId: string
  createdAt: Date
}

interface TaskAttachment {
  id: string
  fileName: string
  fileUrl: string
  fileSize?: number
  fileType?: string
  uploadedBy: string
  createdAt: Date
}

interface Task {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  dueDate: Date | null
  completionDate: Date | null
  serviceType?: string | null
  remarks?: string | null
  acceptanceStatus?: "PENDING" | "ACCEPTED" | "DECLINED"
  acceptedAt?: Date | string | null
  declinedReason?: string | null
  client: {
    id: string
    name: string
  }
  assignedEmployee?: {
    id: string
    name: string
  } | null
  comments: TaskComment[]
  attachments: TaskAttachment[]
  /// Present when loaded via getTaskDetail / getTasksData includes
  blockedBy?: Array<{ blocker: { id: string; title: string; status: string } }>
  blocking?: Array<{ task: { id: string; title: string; status: string } }>
}

interface TaskDetailDrawerProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: (taskId: string, status: TaskStatus) => void
  onAccept?: (taskId: string) => void
  onDecline?: (taskId: string, reason: string, reasonCode: string) => void
  onAddComment?: (taskId: string, content: string) => void
  onDeleteComment?: (commentId: string) => void
  onDeleteAttachment?: (attachmentId: string) => void
  /** Called after a successful attachment upload so the parent can refetch */
  onUploaded?: (taskId: string) => void
  currentUser?: { id: string; name: string; role: string }
  userNameMap?: Record<string, string>
}

export function TaskDetailDrawer({
  task,
  open,
  onOpenChange,
  onStatusChange,
  onAccept,
  onDecline,
  onAddComment,
  onDeleteComment,
  onDeleteAttachment,
  onUploaded,
  currentUser,
  userNameMap = {},
}: TaskDetailDrawerProps) {
  const [commentText, setCommentText] = useState("")
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [declineCode, setDeclineCode] = useState<string>(DECLINE_REASONS[0].value)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleAddComment = async () => {
    if (!commentText.trim() || !task) return

    setIsSubmittingComment(true)
    try {
      await onAddComment?.(task.id, commentText)
      setCommentText("")
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !task) return

    // Validate file size (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      toast.error("File size exceeds 25MB limit")
      return
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("File type not allowed. Use PDF, JPEG, PNG, GIF, WebP, DOCX, or XLSX")
      return
    }

    setIsUploading(true)
    try {
      // Upload to Supabase Storage
      const timestamp = Date.now()
      const path = `task-attachments/${task.id}/${timestamp}-${file.name}`
      const uploadResult = await uploadFile(file, path)

      if (uploadResult.error) {
        toast.error(uploadResult.error)
        return
      }

      // Add attachment record
      const attachmentResult = await addAttachment(
        task.id,
        file.name,
        uploadResult.data?.path || path,
        file.size,
        file.type
      )

      if (attachmentResult.success) {
        toast.success("Attachment uploaded successfully")
        // Ask the parent to refetch — previously this abused onAddComment("")
        // which fired a spurious "Comment cannot be empty" error toast.
        onUploaded?.(task.id)
      } else {
        toast.error(attachmentResult.error || "Failed to add attachment")
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload attachment")
    } finally {
      setIsUploading(false)
      // Reset file input
      e.target.value = ""
    }
  }

  const canEdit = currentUser?.role === "PARTNER" || currentUser?.role === "MANAGER" ||
    (currentUser?.role === "EMPLOYEE" && task?.assignedEmployee?.id === currentUser?.id)

  // Employees submit work as UNDER_REVIEW; only a Manager/Partner may sign a
  // task off as FILED_DONE (mirrors the server-side review gate).
  const isEmployeeViewer = currentUser?.role === "EMPLOYEE"
  const STATUS_OPTIONS: TaskStatus[] = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "DATA_AWAITED",
    "UNDER_REVIEW",
    ...(isEmployeeViewer ? [] : (["FILED_DONE"] as TaskStatus[])),
    "ON_HOLD",
  ]

  if (!task) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[700px] bg-background/95 backdrop-blur">
        <SheetHeader className="mb-6">
          <div className="flex items-start justify-between">
            <SheetTitle className="text-xl font-semibold">{task.title}</SheetTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* SheetContent is `flex flex-col h-full`, so take the leftover height
            with flex-1 + min-h-0 rather than a hardcoded header offset — the
            old h-[calc(100vh-8rem)] pushed content off-screen whenever a long
            task title wrapped the header, and 100vh is wrong on mobile. */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-2">
          {/* Task Info */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              {task.acceptanceStatus && <TaskAcceptanceBadge acceptance={task.acceptanceStatus} />}
              {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
              {(task.blockedBy ?? []).some((d) => d.blocker.status !== "FILED_DONE") && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                  <Lock className="h-3 w-3" /> Blocked
                </span>
              )}
            </div>

            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.08]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  Client
                </div>
                <div className="text-sm font-medium">{task.client.name}</div>
              </div>

              {task.assignedEmployee && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Assigned To
                  </div>
                  <div className="text-sm font-medium">{task.assignedEmployee.name}</div>
                </div>
              )}

              {task.dueDate && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Due Date
                  </div>
                  <div className="text-sm font-medium">{format(new Date(task.dueDate), "PPP")}</div>
                </div>
              )}

              {task.completionDate && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Completed
                  </div>
                  <div className="text-sm font-medium">{format(new Date(task.completionDate), "PPP")}</div>
                </div>
              )}
            </div>

            {task.remarks && (
              <div className="pt-4 border-t border-white/[0.08]">
                <div className="text-xs text-muted-foreground mb-2">Remarks</div>
                <div className="text-sm bg-white/[0.02] border border-white/[0.08] rounded-lg p-3">
                  {task.remarks}
                </div>
              </div>
            )}

            {/* Accept / decline — the assigned employee must accept before working */}
            {isEmployeeViewer && task.acceptanceStatus === "PENDING" && (
              <div className="pt-4 border-t border-white/[0.08]">
                <div className="text-xs text-muted-foreground mb-2">This task was assigned to you</div>
                {declineOpen ? (
                  <div className="space-y-2">
                    {/* A category as well as the words. Free text alone could
                        not tell the firm whether work is being refused for
                        capacity, for skill, or for missing information — which
                        is the only thing that makes the pattern actionable. */}
                    <select
                      value={declineCode}
                      onChange={(e) => setDeclineCode(e.target.value)}
                      className="input-premium h-9 w-full rounded-lg px-3 text-sm"
                    >
                      {DECLINE_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <Textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="Anything the manager should know before reassigning it…"
                      className="min-h-20"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!declineReason.trim()}
                        onClick={() => {
                          onDecline?.(task.id, declineReason.trim(), declineCode)
                          setDeclineOpen(false)
                          setDeclineReason("")
                          setDeclineCode(DECLINE_REASONS[0].value)
                        }}
                      >
                        Submit decline
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeclineOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" className="btn-glow" onClick={() => onAccept?.(task.id)}>
                      Accept task
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeclineOpen(true)}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            )}

            {isEmployeeViewer && task.acceptanceStatus === "DECLINED" && (
              <div className="pt-4 border-t border-white/[0.08] text-sm text-muted-foreground">
                You declined this task{task.declinedReason ? `: "${task.declinedReason}"` : ""}. A manager
                needs to reassign it.
              </div>
            )}

            {task.acceptanceStatus === "ACCEPTED" && task.acceptedAt && task.status !== "FILED_DONE" && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-sm">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="font-medium text-emerald-300">
                  Day {daysWorkedSince(task.acceptedAt)}
                </span>
                <span className="text-muted-foreground">
                  · accepted {format(new Date(task.acceptedAt), "dd MMM yyyy")}
                </span>
              </div>
            )}

            {/* Status buttons — employees can only touch them once accepted */}
            {canEdit && !(isEmployeeViewer && task.acceptanceStatus !== "ACCEPTED") && (
              <div className="pt-4 border-t border-white/[0.08]">
                <div className="text-xs text-muted-foreground mb-2">Update Status</div>
                {isEmployeeViewer && (
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Done with this? Submit it as <span className="text-foreground">Under Review</span> — a
                    Manager or Partner signs off Filed/Done.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <Button
                      key={status}
                      variant={task.status === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => onStatusChange?.(task.id, status)}
                      className={cn(
                        task.status === status && "btn-glow"
                      )}
                    >
                      {status.replace(/_/g, " ")}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dependencies */}
          <TaskDependencies
            taskId={task.id}
            blockedBy={(task.blockedBy ?? []).map((d) => d.blocker)}
            blocking={(task.blocking ?? []).map((d) => d.task)}
            canEdit={Boolean(canEdit)}
            // onUploaded is the drawer's existing "refetch this task" pipe
            onChanged={() => onUploaded?.(task.id)}
          />

          {/* Time tracking */}
          <div className="pt-4 border-t border-white/[0.08]">
            <TaskTimer taskId={task.id} />
          </div>

          {/* Attachments */}
          <div className="space-y-3 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" />
                Attachments ({task.attachments.length})
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="attachment-upload"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx"
                    className="hidden"
                  />
                  <label
                    htmlFor="attachment-upload"
                    className={cn(
                      "cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {task.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between bg-white/[0.02] border border-white/[0.08] rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{attachment.fileName}</div>
                        {attachment.fileSize && (
                          <div className="text-xs text-muted-foreground">
                            {(attachment.fileSize / 1024).toFixed(1)} KB
                          </div>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDeleteAttachment?.(attachment.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {task.attachments.length === 0 && !isUploading && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No attachments yet
                </div>
              )}
            </div>

          {/* Comments */}
          <div className="space-y-3 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              Comments ({task.comments.length})
            </div>

            <div className="space-y-3">
              {task.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="text-sm font-medium">
                      {comment.userId
                        ? (userNameMap[comment.userId] ?? "Team Member")
                        : "System"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(comment.createdAt), "PPP 'at' p")}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">{comment.content}</div>
                  {canEdit && comment.userId === currentUser?.id && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 mt-2"
                      onClick={() => onDeleteComment?.(comment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}

              {task.comments.length === 0 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No comments yet
                </div>
              )}
            </div>

            {/* Add Comment */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
              />
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim() || isSubmittingComment}
                className="self-end"
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
