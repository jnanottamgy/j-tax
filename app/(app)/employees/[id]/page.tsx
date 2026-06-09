import { notFound, redirect } from "next/navigation"

import { prisma } from "@/lib/prisma"
import { requirePartnerOrManager } from "@/lib/auth/guards"

type PageProps = {
  params: { id: string }
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { id } = params

  if (!id) notFound()

  let sessionUserRole: "PARTNER" | "MANAGER" | string = "CLIENT"
  try {
    const session = await requirePartnerOrManager()
    sessionUserRole = session.user.role
  } catch (e) {
    if (e instanceof Error && e.message.includes("Forbidden")) redirect("/unauthorized")
    redirect("/unauthorized")
  }

  if (sessionUserRole !== "PARTNER" && sessionUserRole !== "MANAGER") {
    redirect("/unauthorized")
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!employee) notFound()

  // Reuse the list page shell but pass a single employee is not supported.
  // Provide a simple standalone view.
  return (
    <div className="space-y-6">
      <div className="surface-elevated rounded-xl border border-white/[0.08] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{employee.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{employee.email}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Department: {employee.department ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">
              Status: {employee.isActive ? "Active" : "Inactive"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Joined: {new Date(employee.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Keep edit UX accessible via the existing dialog from the list module.
          For now, show a disabled dialog shell; full edit wiring can be added later. */}
      <div className="surface-elevated rounded-xl border border-white/[0.08] p-6 text-sm text-muted-foreground">
        Employee management UI (edit/disable/enable/delete) is available from <a href="/employees" className="underline">Employees</a>.
      </div>
    </div>
  )
}
