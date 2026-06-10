"use client"

import { format } from "date-fns"
import { FileText, Download, Lock, History } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

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

interface DocumentListProps {
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

export function DocumentList({
  documents,
  onDocumentClick,
  onDownload,
  canModify: _canModify = false,
}: DocumentListProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
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
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.08] hover:bg-transparent">
            <TableHead className="text-muted-foreground">Document</TableHead>
            <TableHead className="text-muted-foreground">Client</TableHead>
            <TableHead className="text-muted-foreground">Category</TableHead>
            <TableHead className="text-muted-foreground">Size</TableHead>
            <TableHead className="text-muted-foreground">Version</TableHead>
            <TableHead className="text-muted-foreground">Uploaded</TableHead>
            <TableHead className="text-muted-foreground">Tags</TableHead>
            <TableHead className="text-muted-foreground w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => {
            const config = CATEGORY_CONFIG[document.category]

            return (
              <TableRow
                key={document.id}
                className="border-white/[0.08] hover:bg-white/[0.03] cursor-pointer transition-colors"
                onClick={() => onDocumentClick?.(document.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{document.title}</span>
                      <span className="text-xs text-muted-foreground">{document.fileName}</span>
                    </div>
                    {document.isConfidential && (
                      <Lock className="h-3 w-3 text-red-400" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{document.client.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={config.color}>
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatFileSize(document.fileSize)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    {document._count.versions > 1 && <History className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-muted-foreground">v{document.version}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(document.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
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
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDownload?.(document.id)
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
