import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { requirePartnerOrManager } from "@/lib/auth/guards"
import { getSession } from "@/lib/auth/session"
import { getQuotationById } from "@/app/actions/proposals"
import { QuotationDetailClient } from "@/components/proposals/quotation-detail-client"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"

export const metadata = { title: "Quotation Detail" }

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  try {
    await requirePartnerOrManager()
  } catch {
    redirect("/unauthorized")
  }

  const { id } = await params
  const [quotation, session] = await Promise.all([
    getQuotationById(id),
    getSession(),
  ])

  if (!quotation || !session) notFound()

  const backLink = (
    <Link href="/proposals" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <ChevronLeft className="size-4" />
      Proposals
    </Link>
  )

  return (
    <PageContainer>
      <PageHeader
        title={`Quotation #${quotation.quotationNumber}`}
        description={`${quotation.clientName} · ${quotation.clientEmail}`}
        action={backLink}
      />
      <QuotationDetailClient
        quotation={quotation}
        isPartner={session.user.role === "PARTNER"}
      />
    </PageContainer>
  )
}
