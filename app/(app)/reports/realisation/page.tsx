import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { RealisationClient } from "./realisation-client"

export default function FeeRealisationPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Reports", href: "/reports" }, { label: "Fee Realisation" }]} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fee realisation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What was agreed, what was billed, and what actually arrived.
        </p>
      </div>
      <RealisationClient />
    </PageContainer>
  )
}
