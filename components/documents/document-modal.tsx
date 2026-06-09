"use client"

import { useState } from "react"
import { format } from "date-fns"
import { X, Download, Lock, History, Tag, Trash2, FileEdit, Plus } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { RenameDocumentDialog } from "@/components/documents/rename-document-dialog"
import { cn } from "@/lib/utils"

type DocumentCategory =
  | "GST" | "TDS" | "ROC" | "AUDIT" | "INCOME_TAX"
  | "PAYROLL" | "BANK_STATEMENTS" | "INVOICES" | "AGREEMENTS" | "OTHER"

interface Document {
  id: string
  title: string
  category: DocumentCategory
  fileName: string
  fileSize: number
  fileType: string
  description?: string | null
  isConfidential: boolean
  version: number
  createdAt: Date
  updatedAt: Date
  client: { id: string; name: string }
  tags: Array<{ id: string; tag: string }>
  versions: Array<{
    id: string; version: number; fileName: string
    fileSize: number; uploadedBy: string
    changeNotes?: string | null; createdAt: Date
  }>
  activities: Array<{
    id: string; activityType: string
    userId: string; createdAt: Date; metadata?: any
  }>
}

interface DocumentModalProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload?: (documentId: string) => void
  onDelete?: (documentId: string) => void
  onEdit?: (documentId: string) => void        // called after rename succeeds → triggers reload
  onAddTag?: (documentId: string, tag: string) => void
  onRemoveTag?: (documentId: string, tag: string) => void
  currentUser?: { id: string; name: string; role: string }
}

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; color: string }> = {
  GST:            { label: "GST",            color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  TDS:            { label: "TDS",            color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  ROC:            { label: "ROC",            color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  AUDIT:          { label: "Audit",          color: "bg-red-500/10 text-red-400 border-red-500/20" },
  INCOME_TAX:     { label: "Income Tax",     color: "bg-green-500/10 text-green-400 border-green-500/20" },
  PAYROLL:        { label: "Payroll",        color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  BANK_STATEMENTS:{ label: "Bank Statements",color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  INVOICES:       { label: "Invoices",       color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  AGREEMENTS:     { label: "Agreements",     color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  OTHER:          { label: "Other",          color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024, units = ["B","KB","MB","GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

export function DocumentModal({
  document,
  open,
  onOpenChange,
  onDownload,
  onDelete,
  onEdit,
  onAddTag,
  onRemoveTag,
  currentUser,
}: DocumentModalProps) {
  const [newTag, setNewTag]           = useState("")
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [renameOpen, setRenameOpen]   = useState(false)

  const canModify = currentUser?.role === "PARTNER" || currentUser?.role === "MANAGER"

  const handleAddTag = async () => {
    if (!newTag.trim() || !document) return
    setIsAddingTag(true)
    try { await onAddTag?.(document.id, newTag.trim()); setNewTag("") }
    finally { setIsAddingTag(false) }
  }

  const handleDelete = async () => {
    if (!document || !canModify) return
    if (!confirm("Delete this document? This cannot be undone.")) return
    await onDelete?.(document.id)
    onOpenChange(false)
  }

  if (!document) return null

  const config = CATEGORY_CONFIG[document.category] ?? CATEGORY_CONFIG.OTHER

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background/95 backdrop-blur max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-semibold mb-2 break-words pr-2">
                  {document.title}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={config.color}>{config.label}</Badge>
                  {document.isConfidential && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                      <Lock className="h-3 w-3" />Confidential
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-white/[0.04]">v{document.version}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 shrink-0" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">File Name</Label>
                <div className="text-sm font-mono break-all">{document.fileName}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">File Size</Label>
                <div className="text-sm">{formatFileSize(document.fileSize)}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Client</Label>
                <div className="text-sm">{document.client.name}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Uploaded</Label>
                <div className="text-sm">{format(new Date(document.createdAt), "PPP")}</div>
              </div>
            </div>

            {document.description && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="text-sm bg-white/[0.02] border border-white/[0.08] rounded-lg p-3">
                  {document.description}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Tag className="h-3 w-3" />Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {document.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="gap-1">
                    {tag.tag}
                    {canModify && (
                      <button onClick={() => onRemoveTag?.(document.id, tag.tag)} className="ml-1 hover:text-destructive" aria-label={`Remove ${tag.tag}`}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
                {canModify && (
                  <div className="flex gap-1">
                    <Input value={newTag} onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Add tag..." className="h-7 w-28 text-xs"
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    />
                    <Button size="sm" variant="outline" className="h-7 px-2"
                      onClick={handleAddTag} disabled={isAddingTag || !newTag.trim()}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Version History */}
            {document.versions.length > 1 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <History className="h-3 w-3" />Version History
                </Label>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {document.versions.map((v) => (
                    <Card key={v.id} className="bg-white/[0.02] border-white/[0.08] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge variant="outline" className="bg-white/[0.04] shrink-0">v{v.version}</Badge>
                          <span className="text-sm truncate">{v.fileName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(v.fileSize)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{format(new Date(v.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      {v.changeNotes && (
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-white/[0.08]">{v.changeNotes}</p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Feed */}
            {document.activities.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Recent Activity</Label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {document.activities.slice(0, 8).map((a) => (
                    <div key={a.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="capitalize">{a.activityType.toLowerCase().replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span>{format(new Date(a.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-white/[0.08]">
              <Button variant="outline" size="sm" className="flex-1 gap-2 min-w-[100px]"
                onClick={() => onDownload?.(document.id)}>
                <Download className="h-4 w-4" />Download
              </Button>
              {canModify && (
                <>
                  <Button variant="outline" size="sm" className="flex-1 gap-2 min-w-[100px]"
                    onClick={() => { onOpenChange(false); setTimeout(() => setRenameOpen(true), 100) }}>
                    <FileEdit className="h-4 w-4" />Rename
                  </Button>
                  <Button variant="outline" size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
                    onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" />Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog — opens after main modal closes */}
      {canModify && (
        <RenameDocumentDialog
          documentId={document.id}
          currentFileName={document.fileName}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          onSuccess={() => {
            setRenameOpen(false)
            onEdit?.(document.id)
          }}
        />
      )}
    </>
  )
}
