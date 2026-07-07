import { requireAuth } from "@/lib/auth/guards"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { TimesheetClient } from "@/components/timesheet/timesheet-client"

export default async function TimesheetPage() {
  // The (app) layout already redirects unauthenticated and CLIENT users;
  // this guard is defence-in-depth and resolves the viewer's role.
  const session = await requireAuth()

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Timesheet" }]} />
      <PageHeader
        label="Time tracking"
        title="Timesheet"
        description="Run timers, log hours against clients and tasks, and review your week."
      />
      <TimesheetClient viewerRole={session.user.role} />
    </PageContainer>
  )
}
