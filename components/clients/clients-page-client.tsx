"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { AddClientDialog } from "@/components/clients/add-client-dialog"
import {
  ImportClientsDialog,
  ExportClientsButton,
} from "@/components/clients/import-clients-dialog"
import { ClientsTable } from "@/components/clients/clients-table"
import { PageHeader } from "@/components/layout/page-header"
import { useClientOnboardingStore } from "@/lib/clients/onboarding-store"
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
  const fromQuotation = searchParams.get("fromQuotation")
  const [prefillReady, setPrefillReady] = useState(false)

  // Onboard-from-quotation: seed the wizard store, then open it prefilled + locked.
  useEffect(() => {
    if (!fromQuotation || !canManage) return
    let cancelled = false
    void (async () => {
      const { getQuotationClientPrefill } = await import("@/app/actions/proposals")
      const prefill = await getQuotationClientPrefill(fromQuotation)
      if (cancelled || !prefill) return
      if (prefill.alreadyConverted && prefill.convertedClientId) {
        toast.info("This quotation was already converted to a client.")
        router.push(`/clients/${prefill.convertedClientId}`)
        return
      }
      useClientOnboardingStore.getState().hydrate({
        basic: prefill.basic,
        services: prefill.services,
        sourceQuotationId: prefill.quotationId,
        lockServices: true,
      })
      setPrefillReady(true)
      toast.success(`Onboarding from quotation ${prefill.quotationNumber} — review and finish.`)
    })()
    return () => {
      cancelled = true
    }
  }, [fromQuotation, canManage, router])

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
                key={prefillReady ? "from-quotation" : "fresh"}
                employees={employees}
                onSuccess={() => router.refresh()}
                defaultOpen={openWizardOnLoad || prefillReady}
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
