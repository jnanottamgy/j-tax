"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Ban,
  Check,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  Plus,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  addRequestItem,
  cancelDocumentRequest,
  getDocumentRequest,
  removeRequestItem,
  reviewRequestItem,
  type DocumentRequestDetail,
  type DocumentRequestItemDetail,
} from "@/app/actions/document-requests"
import { getDocumentDownloadUrl } from "@/app/actions/documents"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  formatEnInDate,
  ItemStatusChip,
  RequestStatusBadge,
} from "./request-list-client"

type RequestDetailDialogProps = {
  requestId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RequestDetailDialog({
  requestId,
  open,
  onOpenChange,
}: RequestDetailDialogProps) {
  const router = useRouter()
  const [detail, setDetail] = useState<DocumentRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()
  const [newItemTitle, setNewItemTitle] = useState("")
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [confirmCancel, setConfirmCancel] = useState(false)

  const loadDetail = useCallback(async () => {
    const result = await getDocumentRequest(requestId)
    if (result.request) {
      setDetail(result.request)
      setLoadError(null)
    } else {
      setLoadError(result.error ?? "Failed to load request.")
    }
    setLoading(false)
  }, [requestId])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void loadDetail()
  }, [open, loadDetail])

  function runMutation(action: () => Promise<{ success?: boolean; error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        toast.success(successMessage)
        await loadDetail()
        router.refresh()
      } else {
        toast.error(result.error ?? "Something went wrong")
      }
    })
  }

  const handleAccept = (itemId: string) =>
    runMutation(() => reviewRequestItem(itemId, "ACCEPTED"), "Item accepted")

  const handleReject = (itemId: string) => {
    const reason = rejectReason.trim()
    if (!reason) {
      toast.error("A rejection reason is required")
      return
    }
    startTransition(async () => {
      const result = await reviewRequestItem(itemId, "REJECTED", reason)
      if (result.success) {
        toast.success("Item rejected — the client will be asked to re-upload")
        setRejectingItemId(null)
        setRejectReason("")
        await loadDetail()
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to reject item")
      }
    })
  }

  const handleAddItem = () => {
    const title = newItemTitle.trim()
    if (!title) return
    startTransition(async () => {
      const result = await addRequestItem(requestId, title)
      if (result.success) {
        toast.success("Item added")
        setNewItemTitle("")
        await loadDetail()
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to add item")
      }
    })
  }

  const handleRemoveItem = (itemId: string) =>
    runMutation(() => removeRequestItem(itemId), "Item removed")

  const handleCancelRequest = async () => {
    const result = await cancelDocumentRequest(requestId)
    if (result.success) {
      toast.success("Request cancelled")
      await loadDetail()
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to cancel request")
    }
  }

  const handleDownload = async (documentId: string) => {
    const result = await getDocumentDownloadUrl(documentId)
    if (result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer")
    } else {
      toast.error(result.error ?? "Failed to generate download link")
    }
  }

  const isOpen = detail?.status === "OPEN"

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" />
              {detail ? detail.title : "Document Request"}
              {detail && <RequestStatusBadge status={detail.status} />}
            </DialogTitle>
            <DialogDescription>
              {detail
                ? `${detail.clientName} · Created ${formatEnInDate(detail.createdAt)}` +
                  (detail.dueDate ? ` · Due ${formatEnInDate(detail.dueDate)}` : "") +
                  (detail.lastRemindedAt
                    ? ` · Last reminded ${formatEnInDate(detail.lastRemindedAt)}`
                    : "")
                : "Loading request details..."}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <p className="py-6 text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : detail ? (
            <div className="space-y-4 pt-1">
              {detail.notes && (
                <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-muted-foreground">
                  {detail.notes}
                </p>
              )}

              {/* Items */}
              <ul className="space-y-2">
                {detail.items.map((item) => (
                  <RequestItemRow
                    key={item.id}
                    item={item}
                    requestIsOpen={isOpen}
                    isPending={isPending}
                    rejecting={rejectingItemId === item.id}
                    rejectReason={rejectReason}
                    onRejectReasonChange={setRejectReason}
                    onStartReject={() => {
                      setRejectingItemId(item.id)
                      setRejectReason("")
                    }}
                    onCancelReject={() => {
                      setRejectingItemId(null)
                      setRejectReason("")
                    }}
                    onConfirmReject={() => handleReject(item.id)}
                    onAccept={() => handleAccept(item.id)}
                    onRemove={() => handleRemoveItem(item.id)}
                    onDownload={handleDownload}
                  />
                ))}
              </ul>

              {/* Add item */}
              {isOpen && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                    placeholder="Add another document item..."
                    disabled={isPending}
                    aria-label="New item title"
                  />
                  <Button
                    variant="outline"
                    className="shrink-0"
                    onClick={handleAddItem}
                    disabled={isPending || !newItemTitle.trim()}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add
                  </Button>
                </div>
              )}

              {/* Footer actions */}
              {isOpen && (
                <div className="flex justify-end border-t border-white/[0.08] pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmCancel(true)}
                    disabled={isPending}
                  >
                    <Ban className="mr-2 size-4" />
                    Cancel request
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this document request?"
        description="The client will no longer see it in their portal and reminders will stop. This cannot be undone."
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        destructive
        onConfirm={handleCancelRequest}
      />
    </>
  )
}

type RequestItemRowProps = {
  item: DocumentRequestItemDetail
  requestIsOpen: boolean
  isPending: boolean
  rejecting: boolean
  rejectReason: string
  onRejectReasonChange: (value: string) => void
  onStartReject: () => void
  onCancelReject: () => void
  onConfirmReject: () => void
  onAccept: () => void
  onRemove: () => void
  onDownload: (documentId: string) => void
}

function RequestItemRow({
  item,
  requestIsOpen,
  isPending,
  rejecting,
  rejectReason,
  onRejectReasonChange,
  onStartReject,
  onCancelReject,
  onConfirmReject,
  onAccept,
  onRemove,
  onDownload,
}: RequestItemRowProps) {
  return (
    <li className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ItemStatusChip status={item.status} />
        <span className="min-w-0 flex-1 text-sm font-medium">{item.title}</span>

        {item.status === "UPLOADED" && requestIsOpen && (
          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              className="h-7 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={onAccept}
              disabled={isPending}
            >
              <Check className="mr-1 size-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={rejecting ? onCancelReject : onStartReject}
              disabled={isPending}
            >
              <X className="mr-1 size-3.5" />
              Reject
            </Button>
          </div>
        )}

        {item.status === "PENDING" && requestIsOpen && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={isPending}
            aria-label={`Remove "${item.title}"`}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Linked document */}
      {item.document && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">
            {item.document.title}
            <span className="ml-1 font-mono opacity-70">
              ({item.document.fileName})
            </span>
          </span>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
            onClick={() => onDownload(item.document!.id)}
          >
            <Download className="size-3" />
            Download
          </button>
        </div>
      )}

      {/* Rejection reason (shown while REJECTED) */}
      {item.status === "REJECTED" && item.rejectionReason && (
        <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-xs text-red-400">
          Rejected: {item.rejectionReason}
        </p>
      )}

      {/* Inline reject reason form */}
      {rejecting && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            placeholder='Why is this document being rejected? e.g. "Wrong financial year"'
            rows={2}
            disabled={isPending}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-lg"
              onClick={onCancelReject}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 rounded-lg"
              onClick={onConfirmReject}
              disabled={isPending || !rejectReason.trim()}
            >
              {isPending ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" />
              ) : (
                <X className="mr-1 size-3.5" />
              )}
              Reject item
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
