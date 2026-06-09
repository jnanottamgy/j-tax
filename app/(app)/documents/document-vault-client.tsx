"use client"

import { useCallback, useEffect, useState } from "react"
import { LayoutGrid, List, Upload, FolderOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentGrid } from "@/components/documents/document-grid"
import { DocumentList } from "@/components/documents/document-list"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentFilters } from "@/components/documents/document-filters"
import { DocumentModal } from "@/components/documents/document-modal"
import { PageHeader } from "@/components/layout/page-header"
import {
  getDocuments,
  createDocumentUploadUrl,
  finalizeDocumentUpload,
  deleteDocument,
  addDocumentTag,
  removeDocumentTag,
  getDocumentDownloadUrl,
  renameDocumentFile,
} from "@/app/actions/documents"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type ViewMode = "grid" | "list"

export function DocumentVaultClient() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [documents, setDocuments] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<{
    clientId?: string
    category?: string
    search?: string
  }>({})

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getDocuments(filters)
      setDocuments(data.documents)
      setClients(data.clients)
      setUser(data.user)
    } catch (error) {
      console.error("Failed to load documents:", error)
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDocumentClick = (documentId: string) => {
    const document = documents.find((d) => d.id === documentId)
    if (document) {
      setSelectedDocument(document)
      setModalOpen(true)
    }
  }

  const MAX_FILE_SIZE_MB = 25
  const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ])

  const uploadToSignedUrl = async (
    signedUrl: string,
    file: File,
    onProgress: (pct: number) => void
  ) => {
    const buildForm = () => {
      const form = new FormData()
      form.append("cacheControl", "3600")
      // Supabase storage signed upload expects the file as the unnamed field.
      form.append("", file)
      return form
    }

    const attemptOnce = () =>
      new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", signedUrl, true)
        xhr.upload.onprogress = (evt) => {
          if (!evt.lengthComputable) return
          const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)))
          onProgress(pct)
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed with status ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error("Network error during upload"))
        xhr.send(buildForm())
      })

    const MAX_ATTEMPTS = 3
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await attemptOnce()
        return
      } catch (err) {
        if (attempt === MAX_ATTEMPTS) throw err
        // exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }
    }
  }

  const handleUpload = async (file: File, metadata: any) => {
    if (isUploading) return
    setIsUploading(true)
    setUploadProgress(0)
    try {
      // Client-side prechecks (server re-checks size/type; server upload path does full signature checks)
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        toast.error("File type not allowed. Upload PDF, DOCX, XLSX, or an image.")
        return
      }
      const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024
      if (file.size > maxBytes) {
        toast.error(`File too large. Max ${MAX_FILE_SIZE_MB} MB.`)
        return
      }

      const prep = await createDocumentUploadUrl({
        clientId: metadata.clientId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })
      if (!prep.signedUrl || !prep.storagePath) {
        toast.error(prep.error || "Failed to prepare upload")
        return
      }

      // Upload with progress + retry
      await uploadToSignedUrl(prep.signedUrl, file, setUploadProgress)

      // Finalize DB record
      const result = await finalizeDocumentUpload({
        storagePath: prep.storagePath,
        title: metadata.title,
        category: metadata.category,
        clientId: metadata.clientId,
        description: metadata.description,
        isConfidential: metadata.isConfidential,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })

      if (result.success) {
        toast.success("Document uploaded successfully")
        setUploadOpen(false)
        await loadData()
      } else if (result.fieldErrors) {
        const firstError = Object.values(result.fieldErrors).flat()[0]
        toast.error(firstError ?? "Please fix the form errors")
      } else {
        toast.error(result.error || "Failed to finalize document upload")
      }
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  const handleDeleteDocument = async (documentId: string) => {
    const result = await deleteDocument(documentId)
    if (result.success) {
      toast.success("Document deleted")
      await loadData()
    } else {
      toast.error(result.error || "Failed to delete document")
    }
  }

  const handleRenameFile = async (documentId: string, newFileName: string) => {
    const result = await renameDocumentFile(documentId, newFileName)
    if (result.success) {
      toast.success("File renamed")
      await loadData()
      const updatedDocument = documents.find((d) => d.id === documentId)
      if (updatedDocument) setSelectedDocument(updatedDocument)
    } else {
      toast.error(result.error || "Failed to rename file")
    }
  }

  // C-04 fix: generate a signed URL and open it in a new tab
  const handleDownloadDocument = async (documentId: string) => {
    const result = await getDocumentDownloadUrl(documentId)
    if (result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer")
    } else {
      toast.error(result.error || "Failed to generate download link")
    }
  }

  const handleAddTag = async (documentId: string, tag: string) => {
    const result = await addDocumentTag(documentId, tag)
    if (result.success) {
      await loadData()
      // Refresh selected document
      const updatedDocument = documents.find((d) => d.id === documentId)
      if (updatedDocument) {
        setSelectedDocument(updatedDocument)
      }
    } else {
      toast.error(result.error || "Failed to add tag")
    }
  }

  const handleRemoveTag = async (documentId: string, tag: string) => {
    const result = await removeDocumentTag(documentId, tag)
    if (result.success) {
      await loadData()
      // Refresh selected document
      const updatedDocument = documents.find((d) => d.id === documentId)
      if (updatedDocument) {
        setSelectedDocument(updatedDocument)
      }
    } else {
      toast.error(result.error || "Failed to remove tag")
    }
  }

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
  }

  const canModify = user?.role === "PARTNER" || user?.role === "MANAGER"

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="h-96">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Button
          size="sm"
          className="btn-glow h-9 gap-1.5 rounded-xl"
          onClick={() => setUploadOpen(true)}
        >
          <Upload className="h-3.5" />
          Upload Document
        </Button>
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <DocumentUpload
          onUpload={handleUpload}
          clients={clients}
          onCancel={() => setUploadOpen(false)}
          isUploading={isUploading}
        />
      )}

      {/* Filters and View Toggle */}
      {!uploadOpen && (
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <DocumentFilters
            onFiltersChange={handleFiltersChange}
            clients={clients}
          />
          <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={cn(
                "h-8 rounded-lg gap-2",
                viewMode === "grid" && "btn-glow"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn(
                "h-8 rounded-lg gap-2",
                viewMode === "list" && "btn-glow"
              )}
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        </div>
      )}

      {/* Document View */}
      {!uploadOpen && (
        <>
          {documents.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">No documents found</p>
              {canModify && (
                <Button size="sm" className="btn-glow" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload your first document
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <DocumentGrid
              documents={documents}
              onDocumentClick={handleDocumentClick}
              onDownload={handleDownloadDocument}
              canModify={canModify}
            />
          ) : (
            <DocumentList
              documents={documents}
              onDocumentClick={handleDocumentClick}
              onDownload={handleDownloadDocument}
              canModify={canModify}
            />
          )}
        </>
      )}

      {/* Document Detail Modal */}
      <DocumentModal
        document={selectedDocument}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onDownload={handleDownloadDocument}
        onDelete={handleDeleteDocument}
        onEdit={async () => {
          await loadData()
          setModalOpen(false)
        }}
        onAddTag={handleAddTag}
        onRemoveTag={handleRemoveTag}
        currentUser={user}
      />
    </>
  )
}
