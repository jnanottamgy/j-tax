import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { GstReconClient } from "./gst-recon-client"

export default function GstReconciliationPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "GST Reconciliation" }]} />
      <PageHeader
        label="GST"
        title="GSTR-2B Reconciliation"
        description="Match the portal's auto-drafted ITC statement against your purchase register — catch unclaimed ITC and at-risk credits before filing 3B."
      />
      <GstReconClient />
    </PageContainer>
  )
}
