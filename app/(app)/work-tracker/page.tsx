import { WorkTrackerClient } from "./work-tracker-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"

export default function WorkTrackerPage() {
  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Work Tracker" }]} />
      <PageHeader
        label="Task management"
        title="Work Tracker"
        description="Track filings, reviews, and team assignments in one unified workflow."
      />
      <WorkTrackerClient />
    </PageContainer>
  )
}
