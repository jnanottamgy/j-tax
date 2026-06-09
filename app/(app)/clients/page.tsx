import { ClientsPageClient } from "@/components/clients/clients-page-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"
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
      <PageHeader
        label="Client management"
        title="Clients"
        description="Manage your client portfolio with comprehensive tracking and insights."
        action={canManage ? <Button asChild className="btn-glow"><Link href="/clients/add">Add Client <Plus /></Link></Button> : undefined}
      />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
          {error.includes("Forbidden") && (
            <span className="mt-1 block text-xs opacity-90">
              Client management requires Partner access, or run database
              migration: npx prisma db push
            </span>
          )}
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
