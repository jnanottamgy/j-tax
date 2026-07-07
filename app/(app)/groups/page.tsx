import { redirect } from "next/navigation"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { GroupsClient } from "./groups-client"
import { listGroups, getGroupAssignableClients, type GroupRow } from "@/app/actions/groups"

export default async function GroupsPage() {
  let groups: GroupRow[] = []
  let clients: Awaited<ReturnType<typeof getGroupAssignableClients>> = []
  let error: string | null = null
  let canManage = false

  try {
    await requirePartnerOrManager()
    canManage = true
    ;[groups, clients] = await Promise.all([listGroups(), getGroupAssignableClients()])
  } catch (e) {
    if (e instanceof Error && e.message.includes("Forbidden")) {
      redirect("/unauthorized")
    }
    error = e instanceof Error ? e.message : "Unable to load client groups. Check the database connection."
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Client Groups" }]} />
      <PageHeader
        label="Operations"
        title="Client Groups"
        description="Bundle group companies, families, or a shared promoter so you can see and manage related clients together."
      />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : (
        <GroupsClient initialGroups={groups} clients={clients} canManage={canManage} />
      )}
    </PageContainer>
  )
}
