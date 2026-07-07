import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { ItrClient } from "./itr-client"

export default function ItrComputationPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "ITR Computation" }]} />
      <PageHeader
        label="Income Tax"
        title="ITR Computation"
        description="Old vs new regime computed side-by-side as you type — 87A, surcharge marginal relief, capital gains, and 234A/B/C interest included."
      />
      <ItrClient />
    </PageContainer>
  )
}
