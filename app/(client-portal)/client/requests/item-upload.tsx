"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { attachUploadToRequestItem } from "@/app/actions/document-requests"
import {
  createClientPortalUploadUrl,
  finalizeClientPortalUpload,
} from "@/app/actions/client-portal-documents"
import { Button } from "@/components/ui/button"

// Mirrors the mechanics of app/(client-portal)/client/documents/upload-form.tsx:
// signed-URL upload → finalize (creates the Document) → attach to request item.

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const MAX_SIZE = 10 * 1024 * 1024 // 10MB, same as the portal upload form

type RequestItemUploadProps = {
  itemId: string
  itemTitle: string
  isReupload?: boolean
}

export function RequestItemUpload({
  itemId,
  itemTitle,
  isReupload = false,
}: RequestItemUploadProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Allow re-selecting the same file after a failure
    e.target.value = ""
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("File type not allowed. Supported: PDF, JPG, PNG, XLSX, DOCX.")
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error("File is too large. Maximum size is 10MB.")
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      // Step 1: signed upload URL
      const urlResult = await createClientPortalUploadUrl({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })
      if (urlResult.error || !urlResult.signedUrl || !urlResult.storagePath) {
        toast.error(urlResult.error ?? "Failed to prepare upload.")
        return
      }

      // Step 2: PUT directly to storage with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", urlResult.signedUrl!)
        xhr.setRequestHeader("Content-Type", file.type)
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 90))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Storage upload failed (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Network error during upload."))
        xhr.send(file)
      })

      // Step 3: finalize — creates the Document record
      setProgress(95)
      const finalResult = await finalizeClientPortalUpload({
        storagePath: urlResult.storagePath,
        title: itemTitle,
        category: "OTHER",
        description: `Uploaded for document request item "${itemTitle}"`,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      })
      if (finalResult.error || !finalResult.documentId) {
        toast.error(finalResult.error ?? "Failed to save the uploaded document.")
        return
      }

      // Step 4: link the new document to this request item
      const attachResult = await attachUploadToRequestItem(
        itemId,
        finalResult.documentId
      )
      if (attachResult.error) {
        toast.error(attachResult.error)
        return
      }

      setProgress(100)
      toast.success(`"${itemTitle}" uploaded — your tax team will review it.`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {uploading && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {progress}%
        </span>
      )}
      <Button
        size="sm"
        variant={isReupload ? "destructive" : "default"}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="mr-1.5 size-3.5" />
            {isReupload ? "Re-upload" : "Upload"}
          </>
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
        className="sr-only"
        onChange={handleFileChange}
        aria-label={`Upload file for ${itemTitle}`}
      />
    </div>
  )
}
