import { redirect } from "next/navigation"

import { EmployeesPageClient } from "@/components/employees/employees-page-client"
import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { getEmployeesData } from "@/app/actions/employees"

export default async function EmployeesPage() {
  let employees: Awaited<ReturnType<typeof getEmployeesData>>["employees"] = []
  let canManage = false
  let viewerRole: "PARTNER" | "MANAGER" | "EMPLOYEE" | "CLIENT" = "EMPLOYEE"
  let error: string | null = null

  try {
    const data = await getEmployeesData()
    employees = data.employees
    canManage = data.user.role === "PARTNER" || data.user.role === "MANAGER"
    viewerRole = data.user.role
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
      {/* Header is rendered inside EmployeesPageClient (it carries the
          Export / Add-employee actions) — avoid a duplicate PageHeader. */}
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
          viewerRole={viewerRole}
        />
      )}
    </PageContainer>
  )
}
