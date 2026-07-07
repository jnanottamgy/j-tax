import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckSquare,
  Mail,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageContainer } from "@/components/layout/page-container"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { requirePartnerOrManager } from "@/lib/auth/guards"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { prisma } from "@/lib/prisma"

type PageProps = {
  // Next 16: params is a Promise and must be awaited
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { id } = await params
  if (!id) notFound()

  let viewerRole: string
  try {
    const session = await requirePartnerOrManager()
    viewerRole = session.user.role
  } catch {
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
      user: { select: { role: true } },
      clients: {
        select: { id: true, name: true, clientCode: true, status: true },
        orderBy: { name: "asc" },
        take: 20,
      },
      tasks: {
        where: { status: { not: "FILED_DONE" } },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          client: { select: { name: true } },
        },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 20,
      },
    },
  })

  if (!employee) notFound()

  const [openTaskCount, completedTaskCount, clientCount] = await Promise.all([
    prisma.task.count({
      where: { assignedEmployeeId: id, status: { not: "FILED_DONE" } },
    }),
    prisma.task.count({ where: { assignedEmployeeId: id, status: "FILED_DONE" } }),
    prisma.client.count({ where: { assignedEmployeeId: id } }),
  ])

  const now = new Date()
  const role = employee.user?.role

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb
        items={[{ label: "Employees", href: "/employees" }, { label: employee.name }]}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/employees" aria-label="Back to employees">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{employee.name}</h1>
              <Badge
                variant="outline"
                className={
                  employee.isActive
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/20 bg-red-500/10 text-red-400"
                }
              >
                {employee.isActive ? "Active" : "Inactive"}
              </Badge>
              {role && (
                <Badge variant="outline" className="border-white/10 bg-white/[0.04]">
                  {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
                </Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-3.5" aria-hidden />
              {employee.email}
              {employee.department && (
                <>
                  <span aria-hidden>·</span>
                  {employee.department}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewerRole === "PARTNER" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/workforce/${employee.id}`}>
                <BarChart3 className="mr-1.5 size-4" />
                Performance
              </Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link href="/employees">Manage in Employees</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
              <CheckSquare className="size-5 text-blue-400" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open Tasks</p>
              <p className="text-2xl font-bold">{openTaskCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <ShieldCheck className="size-5 text-emerald-400" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed Tasks</p>
              <p className="text-2xl font-bold">{completedTaskCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="size-5 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assigned Clients</p>
              <p className="text-2xl font-bold">{clientCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Open tasks */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CheckSquare className="size-4 text-blue-400" aria-hidden />
              Open Tasks
              <Link
                href="/work-tracker"
                className="ml-auto text-[11px] font-normal text-muted-foreground hover:text-foreground"
              >
                Work Tracker →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.tasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No open tasks assigned.
              </p>
            ) : (
              employee.tasks.map((task) => {
                const overdue = task.dueDate && new Date(task.dueDate) < now
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.client?.name ?? "—"}
                        {task.dueDate && (
                          <>
                            {" · "}
                            <span className={overdue ? "text-red-400" : undefined}>
                              due {new Date(task.dueDate).toLocaleDateString("en-IN")}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <Badge className="shrink-0 bg-white/[0.05] text-[10px] text-muted-foreground">
                      {task.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Assigned clients */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-primary" aria-hidden />
              Assigned Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {employee.clients.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No clients assigned.
              </p>
            ) : (
              employee.clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 transition-colors hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{client.name}</p>
                    <p className="text-xs text-muted-foreground">{client.clientCode}</p>
                  </div>
                  <Badge className="shrink-0 bg-white/[0.05] text-[10px] text-muted-foreground">
                    {client.status.replace(/_/g, " ")}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Joined {new Date(employee.createdAt).toLocaleDateString("en-IN")} · Last
        updated {new Date(employee.updatedAt).toLocaleDateString("en-IN")}. Edit,
        disable, or delete this employee from the{" "}
        <Link href="/employees" className="underline hover:text-foreground">
          Employees
        </Link>{" "}
        page.
      </p>
    </PageContainer>
  )
}
