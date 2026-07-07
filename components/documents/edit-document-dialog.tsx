"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem,
} from "@/components/ui/select"
import { updateDocument } from "@/app/actions/documents"

// EXACT enum values from documentSchema.category in app/actions/documents.ts
const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "GST",             label: "GST" },
  { value: "TDS",             label: "TDS" },
  { value: "ROC",             label: "ROC" },
  { value: "AUDIT",           label: "Audit" },
  { value: "INCOME_TAX",      label: "Income Tax" },
  { value: "PAYROLL",         label: "Payroll" },
  { value: "BANK_STATEMENTS", label: "Bank Statements" },
  { value: "INVOICES",        label: "Invoices" },
  { value: "AGREEMENTS",      label: "Agreements" },
  { value: "OTHER",           label: "Other" },
]

interface EditDocumentDialogProps {
  document: {
    id: string
    title: string
    category: string
    description?: string | null
    isConfidential: boolean
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditDocumentDialog({
  document,
  open,
  onOpenChange,
  onSuccess,
}: EditDocumentDialogProps) {
  const [isPending, startTransition] = useTransition()

  const [title, setTitle] = useState(document.title)
  const [category, setCategory] = useState(document.category)
  const [description, setDescription] = useState(document.description ?? "")
  const [isConfidential, setIsConfidential] = useState(
    document.isConfidential ? "true" : "false"
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({})

  // Re-seed the form whenever a different document is opened.
  useEffect(() => {
    if (open) {
      setTitle(document.title)
      setCategory(document.category)
      setDescription(document.description ?? "")
      setIsConfidential(document.isConfidential ? "true" : "false")
      setFieldErrors({})
    }
  }, [open, document.id, document.title, document.category, document.description, document.isConfidential])

  const handleSave = () => {
    setFieldErrors({})

    const fd = new FormData()
    fd.set("id", document.id)
    fd.set("title", title.trim())
    fd.set("category", category)
    fd.set("description", description.trim())
    fd.set("isConfidential", isConfidential)

    startTransition(async () => {
      const result = await updateDocument({}, fd)
      if (result.success) {
        toast.success("Document updated")
        onSuccess?.()
        onOpenChange(false)
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        toast.error("Please fix the highlighted fields")
      } else {
        toast.error(result.error ?? "Failed to update document")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-white/[0.08] bg-popover/95 backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Edit Details
          </DialogTitle>
          <DialogDescription>
            Update this document&apos;s title, category, and description.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="h-10 rounded-xl"
              disabled={isPending}
              autoFocus
            />
            {fieldErrors.title?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="edit-category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isPending}>
              <SelectTrigger id="edit-category" className="h-10 rounded-xl">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.category?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.category[0]}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              disabled={isPending}
            />
            {fieldErrors.description?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.description[0]}</p>
            )}
          </div>

          {/* Confidential */}
          <div className="space-y-2">
            <Label htmlFor="edit-confidential">Confidential</Label>
            <Select
              value={isConfidential}
              onValueChange={setIsConfidential}
              disabled={isPending}
            >
              <SelectTrigger id="edit-confidential" className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="true">Yes — restrict access</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.isConfidential?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.isConfidential[0]}</p>
            )}
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
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
              ) : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
