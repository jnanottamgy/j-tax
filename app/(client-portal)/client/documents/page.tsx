import { redirect } from "next/navigation"
import { format } from "date-fns"
import { FileText, Upload, Search } from "lucide-react"
import { DownloadButton } from "./download-button"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default async function ClientDocumentsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string }
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  // Find the Client record for this user
  const clientRecord = await prisma.client.findFirst({
    where: { email: session.user.email },
    select: { id: true, name: true },
  })

  if (!clientRecord) {
    redirect("/unauthorized")
  }

  const searchQuery = searchParams.q || ""
  const categoryFilter = searchParams.category || ""

  // Build where clause
  const where: any = { clientId: clientRecord.id }

  if (searchQuery) {
    where.OR = [
      { title: { contains: searchQuery, mode: "insensitive" } },
      { description: { contains: searchQuery, mode: "insensitive" } },
    ]
  }

  if (categoryFilter) {
    where.category = categoryFilter
  }

  // Fetch documents for this client
  const [documents, categories] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // Get available categories
    prisma.document.groupBy({
      by: ["category"],
      where: { clientId: clientRecord.id },
      _count: true,
    }),
  ])

  const categoryLabels: Record<string, string> = {
    GST: "GST",
    TDS: "TDS",
    ROC: "ROC",
    AUDIT: "Audit",
    INCOME_TAX: "Income Tax",
    PAYROLL: "Payroll",
    BANK_STATEMENTS: "Bank Statements",
    INVOICES: "Invoices",
    AGREEMENTS: "Agreements",
    OTHER: "Other",
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload and manage your tax documents.
        </p>
      </div>

      {/* Upload CTA */}
      <Card className="border-dashed border-2">
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Upload className="size-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Upload Documents</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Drag and drop files here, or click to browse. Supported formats: PDF, JPG, PNG, Excel.
            </p>
            <Button className="mt-4">
              <Upload className="size-4 mr-2" />
              Select Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            defaultValue={searchQuery}
            name="q"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={!categoryFilter ? "secondary" : "outline"}
            size="sm"
            asChild
          >
            <a href="/client/documents">All</a>
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.category}
              variant={categoryFilter === cat.category ? "secondary" : "outline"}
              size="sm"
              asChild
            >
              <a href={`/client/documents?category=${cat.category}`}>
                {categoryLabels[cat.category] || cat.category}
              </a>
            </Button>
          ))}
        </div>
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" />
                Documents
              </CardTitle>
              <CardDescription>
                {documents.length} document{documents.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="size-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No documents found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Documents uploaded by your tax team will appear here."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow",
                    doc.isConfidential && "border-yellow-500/30 bg-yellow-500/5"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      doc.isConfidential
                        ? "bg-yellow-500/10 text-yellow-500"
                        : "bg-blue-500/10 text-blue-500"
                    )}
                  >
                    <FileText className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm truncate">
                        {doc.title}
                      </p>
                      {doc.isConfidential && (
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0 border-yellow-500/30 text-yellow-500"
                        >
                          Confidential
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {doc.description || doc.category}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span>{format(new Date(doc.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {/* LOW-03: wired to getDocumentDownloadUrl via signed URL */}
                    <DownloadButton documentId={doc.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FileText className="size-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Document Guidelines</p>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Maximum file size: 10MB per document</li>
                <li>• Supported formats: PDF, JPG, PNG, XLS, XLSX</li>
                <li>• Please ensure documents are clear and readable</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}