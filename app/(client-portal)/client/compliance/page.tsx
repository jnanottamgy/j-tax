import { redirect } from "next/navigation"
import { format } from "date-fns"
import { FileText, CheckCircle2, AlertCircle, Clock, Calendar } from "lucide-react"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function ClientCompliancePage() {
  const session = await getSession()
  if (!session) redirect("/login")

  // Find the Client record for this user
  const clientRecord = await prisma.client.findFirst({
    where: { email: session.user.email },
    select: { id: true, name: true },
  })

  if (!clientRecord) {
    redirect("/unauthorized")
  }

  const now = new Date()

  // Fetch compliance data for this client
  const [complianceEvents, complianceStats] = await Promise.all([
    // All compliance events for this client
    prisma.complianceEvent.findMany({
      where: { clientId: clientRecord.id },
      orderBy: [{ dueDate: "desc" }],
      take: 50,
    }),
    // Compliance statistics
    prisma.complianceEvent.groupBy({
      by: ["status"],
      where: { clientId: clientRecord.id },
      _count: true,
    }),
  ])

  const stats = {
    pending: complianceStats.find((s) => s.status === "PENDING")?._count ?? 0,
    completed: complianceStats.find((s) => s.status === "COMPLETED")?._count ?? 0,
    overdue: complianceStats.find((s) => s.status === "OVERDUE")?._count ?? 0,
    cancelled: complianceStats.find((s) => s.status === "CANCELLED")?._count ?? 0,
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="size-3 mr-1" />
            Completed
          </Badge>
        )
      case "OVERDUE":
        return (
          <Badge variant="destructive">
            <AlertCircle className="size-3 mr-1" />
            Overdue
          </Badge>
        )
      case "PENDING":
        return (
          <Badge variant="secondary">
            <Clock className="size-3 mr-1" />
            Pending
          </Badge>
        )
      case "CANCELLED":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            Cancelled
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getWorkflowStatusBadge = (status: string) => {
    switch (status) {
      case "FILED":
      case "COMPLETED":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            {status}
          </Badge>
        )
      case "IN_PROGRESS":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            {status}
          </Badge>
        )
      case "DOCUMENTS_AWAITED":
        return (
          <Badge variant="secondary">
            Documents Awaited
          </Badge>
        )
      case "UNDER_REVIEW":
        return (
          <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
            Under Review
          </Badge>
        )
      case "OVERDUE":
        return (
          <Badge variant="destructive">
            Overdue
          </Badge>
        )
      default:
        return <Badge variant="outline">{status || "Not Started"}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance Status</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your compliance filings and deadlines.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-yellow-500/10">
              <Clock className="size-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-green-500/10">
              <CheckCircle2 className="size-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully filed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-red-500/10">
              <AlertCircle className="size-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Calendar className="size-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pending + stats.completed + stats.overdue + stats.cancelled}
            </div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Events List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5" />
                Compliance Events
              </CardTitle>
              <CardDescription>
                All compliance filings and their current status
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {complianceEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="size-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No compliance events</p>
              <p className="text-sm text-muted-foreground mt-1">
                Compliance events will appear here when created by your tax team.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left py-3 px-3 font-medium">Type</th>
                    <th className="text-left py-3 px-3 font-medium">Title</th>
                    <th className="text-left py-3 px-3 font-medium">Due Date</th>
                    <th className="text-left py-3 px-3 font-medium">Status</th>
                    <th className="text-left py-3 px-3 font-medium">Workflow</th>
                    <th className="text-left py-3 px-3 font-medium">Filing Period</th>
                  </tr>
                </thead>
                <tbody>
                  {complianceEvents.map((event) => (
                    <tr
                      key={event.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/50 transition-colors",
                        event.status === "OVERDUE" && "bg-red-500/5"
                      )}
                    >
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-xs">
                          {event.type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <div>
                          <p className="font-medium">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5 text-muted-foreground" />
                          <span>
                            {format(new Date(event.dueDate), "MMM d, yyyy")}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(event.status)}
                      </td>
                      <td className="py-3 px-3">
                        {getWorkflowStatusBadge(event.workflowStatus)}
                      </td>
                      <td className="py-3 px-3 text-sm text-muted-foreground">
                        {event.filingPeriod || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FileText className="size-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Need help?</p>
              <p className="text-sm text-muted-foreground mt-1">
                If you have questions about any compliance event, please reach out to your tax team through the{" "}
                <a href="/client/messages" className="underline hover:text-blue-500">
                  Messages
                </a>{" "}
                section.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}