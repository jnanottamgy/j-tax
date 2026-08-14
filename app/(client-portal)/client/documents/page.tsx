import { PortalDocumentsClient } from "./documents-client"

export default function ClientDocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What your accountant has asked for, and where to send it.
        </p>
      </div>
      <PortalDocumentsClient />
    </div>
  )
}
