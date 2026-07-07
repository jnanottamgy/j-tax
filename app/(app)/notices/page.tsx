import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { NoticesClient } from "./notices-client"

export default function NoticesPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Notices" }]} />
      <PageHeader
        label="Litigation"
        title="Tax Notices"
        description="Every notice, deadline, and hearing in one register — with automatic reply-deadline alerts to the assigned team member."
      />
      <NoticesClient />
    </PageContainer>
  )
}
