"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDocumentDownloadUrl } from "@/app/actions/documents"

export function DownloadButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const result = await getDocumentDownloadUrl(documentId)
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer")
      } else {
        console.error("Download failed:", result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      title="Download"
      onClick={handleDownload}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </Button>
  )
}
