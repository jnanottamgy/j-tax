import { redirect } from "next/navigation"

import { EmployeesPageClient } from "@/components/employees/employees-page-client"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { getEmployeesData } from "@/app/actions/employees"

export default async function EmployeesPage() {
  let employees: Awaited<ReturnType<typeof getEmployeesData>>["employees"] = []
  let canManage = false
  let error: string | null = null

  try {
    const data = await getEmployeesData()
    employees = data.employees
    canManage = data.user.role === "PARTNER" || data.user.role === "MANAGER"
  } catch (e) {
    if (e instanceof Error && e.message.includes("Forbidden")) {
      redirect("/unauthorized")
    }
    error =
      e instanceof Error
        ? e.message
        : "Unable to load employees. Check database connection."
  }

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb items={[{ label: "Employees" }]} />
      <PageHeader
        label="Team management"
        title="Employees"
        description="Manage your team members and their access permissions."
      />
      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : (
        <EmployeesPageClient
          initialEmployees={employees}
          canManage={canManage}
        />
      )}
    </PageContainer>
  )
}
