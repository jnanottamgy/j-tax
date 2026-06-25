import { redirect, notFound } from "next/navigation"
import { requirePartnerOrManager } from "@/lib/auth/guards"
import { getLeadDetail } from "@/app/actions/proposals"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { LeadDetailClient } from "@/components/proposals/lead-detail-client"

export const metadata = { title: "Lead Details" }

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePartnerOrManager()
  } catch {
    redirect("/unauthorized")
  }

  const { id } = await params
  const data = await getLeadDetail(id)
  if (!data) notFound()

  return (
    <PageContainer>
      <PageHeader
        title={data.lead.name}
        description={`Lead — ${data.lead.company || data.lead.email}`}
        backHref="/proposals"
      />
      <LeadDetailClient lead={data.lead} employees={data.employees} />
    </PageContainer>
  )
}
