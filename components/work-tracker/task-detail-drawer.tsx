"use client"

import { useState } from "react"
import { format } from "date-fns"
import { X, MessageSquare, Paperclip, Clock, User, Building2, Save, Trash2, Upload, Loader2 } from "lucide-react"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TaskStatusBadge } from "./task-status-badge"
import { TaskPriorityBadge } from "./task-priority-badge"
import { DueDateBadge } from "./due-date-badge"
import { addAttachment } from "@/app/actions/tasks"
import { uploadFile } from "@/lib/storage/storage"
import { cn } from "@/lib/utils"
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
}

interface TaskDetailDrawerProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: (taskId: string, status: TaskStatus) => void
  onAddComment?: (taskId: string, content: string) => void
  onDeleteComment?: (commentId: string) => void
  onDeleteAttachment?: (attachmentId: string) => void
  currentUser?: { id: string; name: string; role: string }
  userNameMap?: Record<string, string>
}

export function TaskDetailDrawer({
  task,
  open,
  onOpenChange,
  onStatusChange,
  onAddComment,
  onDeleteComment,
  onDeleteAttachment,
  currentUser,
  userNameMap = {},
}: TaskDetailDrawerProps) {
  const [commentText, setCommentText] = useState("")
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
        // Reload task data to show new attachment
        await onAddComment?.(task.id, "") // Trigger reload
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

  const STATUS_OPTIONS: TaskStatus[] = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "DATA_AWAITED",
    "UNDER_REVIEW",
    "FILED_DONE",
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

        <div className="space-y-6 overflow-y-auto h-[calc(100vh-8rem)] pr-2">
          {/* Task Info */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TaskStatusBadge status={task.status} />
              <TaskPriorityBadge priority={task.priority} />
              {task.dueDate && <DueDateBadge dueDate={task.dueDate} />}
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

            {canEdit && (
              <div className="pt-4 border-t border-white/[0.08]">
                <div className="text-xs text-muted-foreground mb-2">Update Status</div>
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
