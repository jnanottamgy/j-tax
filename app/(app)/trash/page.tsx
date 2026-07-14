import { redirect } from "next/navigation"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { TrashClient } from "./trash-client"
import { getTrashData, type TrashData } from "@/app/actions/trash"

export default async function TrashPage() {
  let data: TrashData = { clients: [], invoices: [] }
  let error: string | null = null
  let canPurge = false

  try {
    const session = await requirePartnerOrManager()
    canPurge = session.user.role === "PARTNER"
    data = await getTrashData()
  } catch (e) {
    if (e instanceof Error && e.message.includes("Forbidden")) {
      redirect("/unauthorized")
    }
    error = e instanceof Error ? e.message : "Unable to load the recycle bin. Check the database connection."
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Recycle Bin" }]} />
      <PageHeader
        label="Operations"
        title="Recycle Bin"
        description="Clients and invoices you delete land here. Restore them, or delete them permanently."
      />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : (
        <TrashClient data={data} canPurge={canPurge} />
      )}
    </PageContainer>
  )
}
