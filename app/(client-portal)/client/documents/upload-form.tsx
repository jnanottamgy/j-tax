"use client"

import { useRef, useState } from "react"
import { Upload, X, FileText, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createClientPortalUploadUrl,
  finalizeClientPortalUpload,
} from "@/app/actions/client-portal-documents"

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const CATEGORIES = [
  { value: "GST", label: "GST" },
  { value: "TDS", label: "TDS" },
  { value: "ROC", label: "ROC" },
  { value: "AUDIT", label: "Audit" },
  { value: "INCOME_TAX", label: "Income Tax" },
  { value: "PAYROLL", label: "Payroll" },
  { value: "BANK_STATEMENTS", label: "Bank Statements" },
  { value: "INVOICES", label: "Invoices" },
  { value: "AGREEMENTS", label: "Agreements" },
  { value: "OTHER", label: "Other" },
]

type Phase = "idle" | "selected" | "uploading" | "finalizing" | "done" | "error"

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("OTHER")
  const [description, setDescription] = useState("")
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<Phase>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    if (!f) return
    if (!ALLOWED_TYPES.includes(f.type)) {
      setErrorMsg("File type not allowed. Supported: PDF, JPG, PNG, XLSX, DOCX.")
      setPhase("error")
      return
    }
    setFile(f)
    setTitle(f.name.replace(/\.[^/.]+$/, "")) // default title = filename without extension
    setErrorMsg("")
    setPhase("selected")
  }

  function reset() {
    setFile(null)
    setTitle("")
    setCategory("OTHER")
    setDescription("")
    setProgress(0)
    setPhase("idle")
    setErrorMsg("")
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleUpload() {
    if (!file) return
    setPhase("uploading")
    setProgress(0)
    setErrorMsg("")

    // Step 1: Get signed upload URL from server
    const urlResult = await createClientPortalUploadUrl({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    if (urlResult.error || !urlResult.signedUrl || !urlResult.storagePath) {
      setErrorMsg(urlResult.error ?? "Failed to prepare upload.")
      setPhase("error")
      return
    }

    // Step 2: PUT file directly to Supabase Storage signed URL (with progress)
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", urlResult.signedUrl!)
        xhr.setRequestHeader("Content-Type", file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 90)) // cap at 90% until finalized
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Storage upload failed (${xhr.status})`))
          }
        }
        xhr.onerror = () => reject(new Error("Network error during upload."))
        xhr.send(file)
      })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.")
      setPhase("error")
      return
    }

    // Step 3: Finalize — create DB record
    setPhase("finalizing")
    setProgress(95)

    const finalResult = await finalizeClientPortalUpload({
      storagePath: urlResult.storagePath,
      title: title.trim() || file.name,
      category,
      description: description.trim() || undefined,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })

    if (finalResult.error) {
      setErrorMsg(finalResult.error)
      setPhase("error")
      return
    }

    setProgress(100)
    setPhase("done")
    // Auto-reset after 2.5 s so user can upload another
    setTimeout(reset, 2500)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
        <CheckCircle2 className="size-12 text-green-500" />
        <p className="font-semibold text-green-600">Document uploaded successfully!</p>
        <p className="text-sm text-muted-foreground">The page will refresh shortly.</p>
      </div>
    )
  }

  if (phase === "uploading" || phase === "finalizing") {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
        <Loader2 className="size-10 text-primary animate-spin" />
        <p className="font-medium">
          {phase === "finalizing" ? "Saving document record…" : "Uploading…"}
        </p>
        <div className="w-full max-w-xs bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="h-2 bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{progress}%</p>
      </div>
    )
  }

  if (phase === "idle") {
    return (
      <div
        className="flex flex-col items-center justify-center py-8 text-center cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) {
            if (inputRef.current) {
              const dt = new DataTransfer()
              dt.items.add(f)
              inputRef.current.files = dt.files
              inputRef.current.dispatchEvent(new Event("change", { bubbles: true }))
            }
          }
        }}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Upload className="size-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Upload Documents</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Drag and drop files here, or click to browse.
          Supported formats: PDF, JPG, PNG, Excel, Word.
        </p>
        <Button className="mt-4">
          <Upload className="size-4 mr-2" />
          Select Files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>
    )
  }

  // phase === "selected" or "error" with file selected
  return (
    <div className="space-y-4 py-2">
      {/* File preview */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
        <FileText className="size-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{file!.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file!.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={reset} className="shrink-0">
          <X className="size-4" />
        </Button>
      </div>

      {/* Metadata fields */}
      <div className="grid gap-3">
        <div>
          <Label htmlFor="doc-title" className="text-sm font-medium">
            Document Title
          </Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GST Return March 2026"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="doc-category" className="text-sm font-medium">
            Category
          </Label>
          <select
            id="doc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="doc-description" className="text-sm font-medium">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="doc-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the document"
            className="mt-1"
          />
        </div>
      </div>

      {phase === "error" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={handleUpload} disabled={!title.trim()}>
          <Upload className="size-4 mr-2" />
          Upload
        </Button>
        <Button variant="outline" onClick={reset}>
          Cancel
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  )
}
