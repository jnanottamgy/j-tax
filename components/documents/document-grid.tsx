"use client"

import { FileText, Download, Lock, History } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type DocumentCategory = "GST" | "TDS" | "ROC" | "AUDIT" | "INCOME_TAX" | "PAYROLL" | "BANK_STATEMENTS" | "INVOICES" | "AGREEMENTS" | "OTHER"

interface Document {
  id: string
  title: string
  category: DocumentCategory
  fileName: string
  fileSize: number
  fileType: string
  isConfidential: boolean
  version: number
  createdAt: Date
  client: {
    id: string
    name: string
  }
  tags: Array<{ tag: string }>
  _count: {
    versions: number
    activities: number
  }
}

interface DocumentGridProps {
  documents: Document[]
  onDocumentClick?: (documentId: string) => void
  onDownload?: (documentId: string) => void
  canModify?: boolean
}

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; color: string }> = {
  GST: { label: "GST", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  TDS: { label: "TDS", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  ROC: { label: "ROC", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  AUDIT: { label: "Audit", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  INCOME_TAX: { label: "Income Tax", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  PAYROLL: { label: "Payroll", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  BANK_STATEMENTS: { label: "Bank Statements", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  INVOICES: { label: "Invoices", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  AGREEMENTS: { label: "Agreements", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  OTHER: { label: "Other", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
}

export function DocumentGrid({
  documents,
  onDocumentClick,
  onDownload,
  canModify: _canModify = false,
}: DocumentGridProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return "📄"
    if (fileType.includes("image")) return "🖼️"
    if (fileType.includes("word") || fileType.includes("doc")) return "📝"
    if (fileType.includes("excel") || fileType.includes("sheet")) return "📊"
    if (fileType.includes("zip") || fileType.includes("rar")) return "📦"
    return "📄"
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No documents found</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map((document) => {
        const config = CATEGORY_CONFIG[document.category]

        return (
          <Card
            key={document.id}
            className="bg-white/[0.02] border-white/[0.08] overflow-hidden hover:bg-white/[0.04] hover:border-white/[0.12] transition-all cursor-pointer group"
            onClick={() => onDocumentClick?.(document.id)}
          >
            <div className="p-4">
              {/* File Icon & Confidential Badge */}
              <div className="flex items-start justify-between mb-3">
                <div className="text-4xl">{getFileIcon(document.fileType)}</div>
                {document.isConfidential && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
                    <Lock className="h-3 w-3" />
                    Confidential
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h4 className="font-medium text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                {document.title}
              </h4>

              {/* Category Badge */}
              <Badge variant="outline" className={cn("mb-3", config.color)}>
                {config.label}
              </Badge>

              {/* Client */}
              <div className="text-xs text-muted-foreground mb-3">
                {document.client.name}
              </div>

              {/* Tags */}
              {document.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {document.tags.slice(0, 2).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs h-5">
                      {tag.tag}
                    </Badge>
                  ))}
                  {document.tags.length > 2 && (
                    <Badge variant="secondary" className="text-xs h-5">
                      +{document.tags.length - 2}
                    </Badge>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <span>{formatFileSize(document.fileSize)}</span>
                  {document._count.versions > 1 && (
                    <span className="flex items-center gap-1">
                      <History className="h-3 w-3" />
                      v{document.version}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDownload?.(document.id)
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
