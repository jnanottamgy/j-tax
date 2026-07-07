import { redirect } from "next/navigation"

import {
  getActiveClientOptionsForRequests,
  listDocumentRequests,
  type ClientOption,
  type DocumentRequestListRow,
} from "@/app/actions/document-requests"
import { RequestListClient } from "@/components/documents/request-list-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"

export default async function DocumentRequestsPage() {
  let requests: DocumentRequestListRow[] = []
  let clientOptions: ClientOption[] = []
  let error: string | null = null

  try {
    ;[requests, clientOptions] = await Promise.all([
      listDocumentRequests(),
      getActiveClientOptionsForRequests(),
    ])
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unauthorized")) {
      redirect("/login")
    }
    if (e instanceof Error && e.message.includes("Forbidden")) {
      redirect("/unauthorized")
    }
    error =
      e instanceof Error
        ? e.message
        : "Unable to load document requests. Check database connection."
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Documents", href: "/documents" },
          { label: "Requests" },
        ]}
      />
      <PageHeader
        label="Client documents"
        title="Document Requests"
        description="Request documents from clients, track uploads, and auto-chase outstanding items."
      />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : (
        <RequestListClient requests={requests} clientOptions={clientOptions} />
      )}
    </PageContainer>
  )
}
