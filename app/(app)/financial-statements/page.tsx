import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { FinancialStatementsClient } from "./fs-client"

export default function FinancialStatementsPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Financial Statements" }]} />
      <PageHeader
        label="Accounts"
        title="Financial Statements"
        description="Drop a trial balance from Tally or Excel — ledgers auto-classify to Schedule III heads and the Balance Sheet balances by construction."
      />
      <FinancialStatementsClient />
    </PageContainer>
  )
}
