"use client"

import { useState, useCallback } from "react"
import { UploadCloud, X, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

type DocumentCategory =
  | "GST" | "TDS" | "ROC" | "AUDIT" | "INCOME_TAX"
  | "PAYROLL" | "BANK_STATEMENTS" | "INVOICES" | "AGREEMENTS" | "OTHER"

interface DocumentUploadProps {
  onUpload: (
    file: File,
    metadata: {
      title: string
      category: DocumentCategory
      clientId: string
      description?: string
      isConfidential: boolean
    }
  ) => Promise<void>
  clients: Array<{ id: string; name: string }>
  onCancel: () => void
  isUploading?: boolean
}

const CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "GST",            label: "GST" },
  { value: "TDS",            label: "TDS" },
  { value: "ROC",            label: "ROC" },
  { value: "AUDIT",          label: "Audit" },
  { value: "INCOME_TAX",     label: "Income Tax" },
  { value: "PAYROLL",        label: "Payroll" },
  { value: "BANK_STATEMENTS",label: "Bank Statements" },
  { value: "INVOICES",       label: "Invoices" },
  { value: "AGREEMENTS",     label: "Agreements" },
  { value: "OTHER",          label: "Other" },
]

const MAX_SIZE_MB = 25
const MAX_SIZE    = MAX_SIZE_MB * 1024 * 1024

const ALLOWED: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg":      ["jpg","jpeg"],
  "image/png":       ["png"],
  "image/gif":       ["gif"],
  "image/webp":      ["webp"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       ["xlsx"],
}

function getExt(name: string) {
  const i = name.lastIndexOf(".")
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ""
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024, units = ["B","KB","MB","GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

/** Client-side validation — mirrors server validateUploadFile() */
async function validateFile(file: File): Promise<string | null> {
  if (!file || file.size === 0)   return "File is empty."
  if (file.size > MAX_SIZE)       return `File exceeds ${MAX_SIZE_MB} MB limit.`

  const rule = ALLOWED[file.type]
  if (!rule)                      return `File type "${file.type}" is not allowed. Use PDF, JPEG, PNG, DOCX, or XLSX.`

  const ext = getExt(file.name)
  if (!rule.includes(ext))        return `Extension ".${ext}" does not match file type.`

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())

  if (file.type === "application/pdf") {
    const s = new TextDecoder().decode(head)
    if (!s.startsWith("%PDF-")) return "Invalid PDF file (missing %PDF header)."
  }

  if (file.type.includes("wordprocessingml") || file.type.includes("spreadsheetml")) {
    if (!(head[0] === 0x50 && head[1] === 0x4b)) return "Invalid Office file (expected .docx/.xlsx zip container)."
    const scan = new Uint8Array(await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer())
    const marker = new TextEncoder().encode("vbaProject.bin")
    let found = false
    outer: for (let i = 0; i <= scan.length - marker.length; i++) {
      for (let j = 0; j < marker.length; j++) {
        if (scan[i + j] !== marker[j]) continue outer
      }
      found = true; break
    }
    if (found) return "Macro-enabled Office files (.xlsm, .docm) are not allowed. Please save as .xlsx/.docx without macros."
  }

  if (file.type === "image/png") {
    const sig = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]
    if (sig.some((b, i) => head[i] !== b)) return "Invalid PNG file."
  }

  if (file.type === "image/jpeg") {
    if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) return "Invalid JPEG file."
  }

  if (file.type === "image/gif") {
    const s = new TextDecoder().decode(head.slice(0, 6))
    if (!(s === "GIF87a" || s === "GIF89a")) return "Invalid GIF file."
  }

  if (file.type === "image/webp") {
    const s1 = new TextDecoder().decode(head.slice(0, 4))
    const s2 = new TextDecoder().decode(head.slice(8, 12))
    if (!(s1 === "RIFF" && s2 === "WEBP")) return "Invalid WebP file."
  }

  return null
}

export function DocumentUpload({ onUpload, clients, onCancel, isUploading }: DocumentUploadProps) {
  const [dragActive, setDragActive]         = useState(false)
  const [selectedFile, setSelectedFile]     = useState<File | null>(null)
  const [fileError, setFileError]           = useState<string | null>(null)
  const [title, setTitle]                   = useState("")
  const [category, setCategory]             = useState<DocumentCategory>("OTHER")
  const [clientId, setClientId]             = useState("")
  const [description, setDescription]       = useState("")
  const [isConfidential, setIsConfidential] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage]       = useState<"idle"|"validating"|"uploading"|"done"|"error">("idle")
  const [retryCount, setRetryCount]         = useState(0)

  const selectFile = useCallback(async (file: File) => {
    setFileError(null)
    setUploadStage("validating")
    const err = await validateFile(file)
    setUploadStage("idle")
    if (err) { setFileError(err); setSelectedFile(null); return }
    setSelectedFile(file)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""))
  }, [title])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === "dragenter" || e.type === "dragover")
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) selectFile(e.dataTransfer.files[0])
  }, [selectFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) selectFile(e.target.files[0])
  }

  const handleUpload = async () => {
    if (!selectedFile || !title || !clientId) return
    setUploadStage("uploading")
    setUploadProgress(0)

    // Simulate progress while the server action runs (real XHR progress
    // would require the signed-URL flow, but server actions don't expose it)
    const timer = setInterval(() => {
      setUploadProgress((p) => (p < 85 ? p + 5 : p))
    }, 200)

    try {
      await onUpload(selectedFile, { title, category, clientId, description: description || undefined, isConfidential })
      clearInterval(timer)
      setUploadProgress(100)
      setUploadStage("done")
    } catch {
      clearInterval(timer)
      setUploadStage("error")
    }
  }

  const handleRetry = () => {
    setRetryCount((c) => c + 1)
    setUploadStage("idle")
    setUploadProgress(0)
    handleUpload()
  }

  const busy = isUploading || uploadStage === "uploading" || uploadStage === "validating"

  return (
    <Card className="bg-white/[0.02] border-white/[0.08] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Upload Document</h3>
        <Button variant="ghost" size="icon-sm" onClick={onCancel} disabled={busy}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-6">
        {/* Drop Zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-all",
            dragActive     ? "border-primary bg-primary/5" : "border-white/[0.12] hover:border-white/[0.24]",
            selectedFile   ? "border-primary/50 bg-primary/5" : "",
            fileError      ? "border-destructive/50 bg-destructive/5" : ""
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {uploadStage === "validating" ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validating file...</p>
            </div>
          ) : selectedFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <div className="font-medium text-sm">{selectedFile.name}</div>
                  <div className="text-xs text-muted-foreground">{formatSize(selectedFile.size)} · {selectedFile.type || "unknown"}</div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => { setSelectedFile(null); setFileError(null); setUploadStage("idle") }} disabled={busy}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Progress bar */}
              {(uploadStage === "uploading" || uploadStage === "done") && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground text-center">
                    {uploadStage === "done" ? "Upload complete" : `Uploading... ${uploadProgress}%`}
                  </p>
                </div>
              )}
              {uploadStage === "error" && (
                <div className="flex items-center gap-2 justify-center text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Upload failed.</span>
                  {retryCount < 3 && (
                    <Button variant="ghost" size="sm" onClick={handleRetry} className="h-6 text-xs">
                      Retry
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <UploadCloud className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Drag and drop your file here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPEG, PNG, GIF, WebP, DOCX, XLSX · max {MAX_SIZE_MB} MB
                </p>
              </div>
              <Input type="file" onChange={handleFileChange} className="hidden" id="file-upload"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.docx,.xlsx"
              />
              <Label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
              >
                Browse Files
              </Label>
            </div>
          )}
        </div>

        {/* File validation error */}
        {fileError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {fileError}
          </div>
        )}

        {/* Allowed types hint */}
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          <span className="mr-1">Allowed:</span>
          {["PDF","JPEG","PNG","GIF","WebP","DOCX","XLSX"].map((t) => (
            <Badge key={t} variant="outline" className="text-xs h-5 border-white/[0.10]">{t}</Badge>
          ))}
        </div>

        {/* Metadata form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title <span className="text-destructive">*</span></Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" disabled={busy} className="h-10 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doc-category">Category</Label>
              <select id="doc-category" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                disabled={busy}
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-client">Client <span className="text-destructive">*</span></Label>
              <select id="doc-client" value={clientId} onChange={(e) => setClientId(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                disabled={busy}
              >
                <option value="">Select client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-desc">Description</Label>
            <Textarea id="doc-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description" rows={2} disabled={busy} className="rounded-xl resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="doc-confidential" checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              disabled={busy} className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="doc-confidential" className="text-sm cursor-pointer">Mark as confidential</Label>
            {isConfidential && (
              <Badge variant="outline" className="ml-auto bg-red-500/10 text-red-400 border-red-500/20">Confidential</Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-white/[0.08]">
          <Button variant="outline" onClick={onCancel} disabled={busy} className="flex-1 h-10 rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !title.trim() || !clientId || busy || !!fileError}
            className="flex-1 h-10 rounded-xl btn-glow"
          >
            {uploadStage === "uploading" ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading {uploadProgress}%</>
            ) : uploadStage === "validating" ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Validating...</>
            ) : uploadStage === "done" ? (
              <><CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" />Uploaded</>
            ) : (
              <><UploadCloud className="h-4 w-4 mr-2" />Upload Document</>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
