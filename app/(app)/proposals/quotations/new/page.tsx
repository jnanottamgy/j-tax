import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { requirePartnerOrManager } from "@/lib/auth/guards"
import { getLeads } from "@/app/actions/proposals"
import { QuotationBuilderClient } from "@/components/proposals/quotation-builder-client"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"

export const metadata = { title: "New Quotation" }

export default async function NewQuotationPage() {
  try {
    await requirePartnerOrManager()
  } catch {
    redirect("/unauthorized")
  }

  const leads = await getLeads()

  const backLink = (
    <Link href="/proposals" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ChevronLeft className="size-4" />
      Proposals
    </Link>
  )

  return (
    <PageContainer>
      <PageHeader
        title="New Quotation"
        description="Build a professional quotation for a prospective client"
        action={backLink}
      />
      <QuotationBuilderClient leads={leads} />
    </PageContainer>
  )
}
