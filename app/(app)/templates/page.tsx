import { redirect } from "next/navigation"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { TemplatesPageClient } from "@/components/templates/templates-page-client"
import {
  getActiveClientOptions,
  getActiveEmployeeOptions,
  listJobTemplates,
  type ClientOption,
  type EmployeeOption,
  type JobTemplateListItem,
} from "@/app/actions/job-templates"

export default async function TemplatesPage() {
  let templates: JobTemplateListItem[] = []
  let clients: ClientOption[] = []
  let employees: EmployeeOption[] = []
  let error: string | null = null

  try {
    await requirePartnerOrManager()
    ;[templates, clients, employees] = await Promise.all([
      listJobTemplates(),
      getActiveClientOptions(),
      getActiveEmployeeOptions(),
    ])
  } catch (e) {
    if (e instanceof Error && e.message.includes("Forbidden")) {
      redirect("/unauthorized")
    }
    error =
      e instanceof Error
        ? e.message
        : "Unable to load job templates. Check database connection."
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Job templates" }]} />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : (
        <TemplatesPageClient
          initialTemplates={templates}
          clients={clients}
          employees={employees}
        />
      )}
    </PageContainer>
  )
}
