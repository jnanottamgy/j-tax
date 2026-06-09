import { MessagingDashboardClient } from "./messaging-dashboard-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"

export default function MessagingPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Messaging" }]} />
      <PageHeader
        label="Communication"
        title="Messaging Dashboard"
        description="WhatsApp automation and communication management."
      />
      <MessagingDashboardClient />
    </PageContainer>
  )
}
