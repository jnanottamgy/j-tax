"use client"

import { useState, useTransition } from "react"
import { Loader2, FileEdit } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { renameDocumentFile } from "@/app/actions/documents"

interface RenameDocumentDialogProps {
  documentId: string
  currentFileName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function RenameDocumentDialog({
  documentId,
  currentFileName,
  open,
  onOpenChange,
  onSuccess,
}: RenameDocumentDialogProps) {
  const [isPending, startTransition] = useTransition()

  // Keep the extension locked — user edits stem only
  const ext = currentFileName.includes(".")
    ? currentFileName.slice(currentFileName.lastIndexOf("."))
    : ""
  const stem = ext ? currentFileName.slice(0, -ext.length) : currentFileName

  const [newStem, setNewStem] = useState(stem)

  const handleSave = () => {
    const combined = ext ? `${newStem.trim()}${ext}` : newStem.trim()
    if (!combined || combined === currentFileName) {
      onOpenChange(false)
      return
    }
    startTransition(async () => {
      const result = await renameDocumentFile(documentId, combined)
      if (result.success) {
        toast.success("Document renamed")
        onSuccess?.()
        onOpenChange(false)
      } else {
        toast.error(result.error ?? "Failed to rename document")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-primary" />
            Rename Document
          </DialogTitle>
          <DialogDescription>
            The file extension cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="rename-stem">File Name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="rename-stem"
                value={newStem}
                onChange={(e) => setNewStem(e.target.value)}
                placeholder="Enter new file name"
                className="flex-1 h-10 rounded-xl"
                disabled={isPending}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              {ext && (
                <span className="text-sm text-muted-foreground font-mono bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
                  {ext}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-mono">{currentFileName}</span>
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-10 rounded-xl btn-glow"
              onClick={handleSave}
              disabled={isPending || !newStem.trim() || newStem.trim() === stem}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Renaming...</>
              ) : "Rename"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
