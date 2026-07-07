import { redirect } from "next/navigation"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { RegistersClient } from "./registers-client"
import {
  listAllRegistrations,
  listAllDscRecords,
  listAllUdinRecords,
  getExpiringRegisterItems,
  type FirmRegistrationRow,
  type FirmDscRow,
  type FirmUdinRow,
  type ExpiringRegistration,
  type ExpiringDsc,
} from "@/app/actions/registers"
import { getActiveClientOptions, type ClientOption } from "@/app/actions/job-templates"

export default async function RegistersPage() {
  let registrations: FirmRegistrationRow[] = []
  let dscs: FirmDscRow[] = []
  let udins: FirmUdinRow[] = []
  let expiring: { registrations: ExpiringRegistration[]; dscs: ExpiringDsc[] } = {
    registrations: [],
    dscs: [],
  }
  let clients: ClientOption[] = []
  let error: string | null = null

  try {
    await requirePartnerOrManager()
    const [regRes, dscRes, udinRes, expiringRes, clientOpts] = await Promise.all([
      listAllRegistrations(),
      listAllDscRecords(),
      listAllUdinRecords(),
      getExpiringRegisterItems(60),
      getActiveClientOptions(),
    ])
    registrations = regRes.registrations ?? []
    dscs = dscRes.dscs ?? []
    udins = udinRes.udins ?? []
    expiring = expiringRes
    clients = clientOpts
    error = regRes.error ?? dscRes.error ?? udinRes.error ?? null
  } catch (e) {
    if (e instanceof Error && e.message.includes("Forbidden")) {
      redirect("/unauthorized")
    }
    error =
      e instanceof Error ? e.message : "Unable to load statutory registers. Check the database connection."
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Statutory Registers" }]} />
      <PageHeader
        label="Compliance"
        title="Statutory Registers"
        description="Registrations, digital signatures, and UDINs across every client — with expiry alerts so nothing lapses."
      />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : (
        <RegistersClient
          registrations={registrations}
          dscs={dscs}
          udins={udins}
          expiring={expiring}
          clients={clients}
        />
      )}
    </PageContainer>
  )
}
