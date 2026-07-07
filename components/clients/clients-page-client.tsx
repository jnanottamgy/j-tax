"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { AddClientDialog } from "@/components/clients/add-client-dialog"
import {
  ImportClientsDialog,
  ExportClientsButton,
} from "@/components/clients/import-clients-dialog"
import { ClientsTable } from "@/components/clients/clients-table"
import { PageHeader } from "@/components/layout/page-header"
import type { ClientListItem, EmployeeOption } from "@/lib/clients/types"

type ClientsPageClientProps = {
  initialClients: ClientListItem[]
  employees: EmployeeOption[]
  canManage: boolean
}

export function ClientsPageClient({
  initialClients,
  employees,
  canManage,
}: ClientsPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Sidebar "New Client" quick action deep-links here with ?new=1
  const openWizardOnLoad = searchParams.get("new") === "1"

  return (
    <>
      <PageHeader
        label="Client management"
        title="Clients"
        description="Master client records powering tasks, payments, documents, and compliance across J-TACS."
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <ExportClientsButton />
              <ImportClientsDialog onSuccess={() => router.refresh()} />
              <AddClientDialog
                employees={employees}
                onSuccess={() => router.refresh()}
                defaultOpen={openWizardOnLoad}
              />
            </div>
          ) : undefined
        }
      />

      <p className="-mt-2 text-[13px] text-muted-foreground/80">
        <span className="font-medium tabular-nums text-foreground/90">
          {initialClients.length}
        </span>{" "}
        master {initialClients.length === 1 ? "entity" : "entities"} in portfolio
      </p>

      <ClientsTable
        clients={initialClients}
        employees={employees}
        canManage={canManage}
      />
    </>
  )
}
