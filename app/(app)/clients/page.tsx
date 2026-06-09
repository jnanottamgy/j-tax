import { ClientsPageClient } from "@/components/clients/clients-page-client"
import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { getClientsData } from "@/app/actions/clients"

export default async function ClientsPage() {
  let clients: Awaited<ReturnType<typeof getClientsData>>["clients"] = []
  let employees: Awaited<ReturnType<typeof getClientsData>>["employees"] = []
  let canManage = false
  let error: string | null = null

  try {
    const data = await getClientsData()
    clients = data.clients
    employees = data.employees
    canManage = data.user.role === "PARTNER" || data.user.role === "MANAGER"
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Unable to load clients. Check database connection."
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Clients" }]} />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : (
        <ClientsPageClient
          initialClients={clients}
          employees={employees}
          canManage={canManage}
        />
      )}
    </PageContainer>
  )
}
