import { redirect } from "next/navigation"
import { requirePartnerOrManager } from "@/lib/auth/guards"
import { getLeads, getQuotations, getProposalAnalytics } from "@/app/actions/proposals"
import { ProposalsClient } from "@/components/proposals/proposals-client"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"

export const metadata = { title: "Proposals & Quotations" }

export default async function ProposalsPage() {
  try {
    await requirePartnerOrManager()
  } catch {
    redirect("/unauthorized")
  }

  const [leads, quotations, analytics] = await Promise.all([
    getLeads(),
    getQuotations(),
    getProposalAnalytics(),
  ])

  return (
    <PageContainer>
      <PageHeader
        title="Proposals & Quotations"
        description="Manage leads, build quotations, and track your revenue pipeline"
      />
      <ProposalsClient
        initialLeads={leads}
        initialQuotations={quotations}
        initialAnalytics={analytics}
      />
    </PageContainer>
  )
}
