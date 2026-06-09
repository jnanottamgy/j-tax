import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Calendar as CalendarIcon, FileText, Receipt, Clock, CheckCircle2, AlertCircle, Upload, MessageSquare } from "lucide-react"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default async function ClientDashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  // Find the Client record for this user
  const clientRecord = await prisma.client.findFirst({
    where: { email: session.user.email },
    select: { id: true, name: true, status: true },
  })

  if (!clientRecord) {
    redirect("/unauthorized")
  }

  const now = new Date()

  // Fetch client-specific data
  const [
    pendingCompliance,
    completedCompliance,
    overdueCompliance,
    upcomingDeadlines,
    invoices,
    recentDocuments,
    recentMessages,
  ] = await Promise.all([
    // Pending compliance events
    prisma.complianceEvent.count({
      where: {
        clientId: clientRecord.id,
        status: "PENDING",
      },
    }),
    // Completed compliance events (last 30 days)
    prisma.complianceEvent.count({
      where: {
        clientId: clientRecord.id,
        status: "COMPLETED",
        completedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    // Overdue compliance events
    prisma.complianceEvent.count({
      where: {
        clientId: clientRecord.id,
        status: "OVERDUE",
      },
    }),
    // Upcoming deadlines (next 14 days)
    prisma.complianceEvent.findMany({
      where: {
        clientId: clientRecord.id,
        dueDate: {
          gte: now,
          lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
        status: { in: ["PENDING"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: {
        task: { select: { title: true } },
      },
    }),
    // Outstanding invoices
    prisma.invoice.findMany({
      where: {
        clientId: clientRecord.id,
        status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
        outstandingAmount: { gt: 0 },
      },
      orderBy: { dueDate: "asc" },
      take: 3,
    }),
    // Recent documents
    prisma.document.findMany({
      where: { clientId: clientRecord.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    // Recent messages
    prisma.message.findMany({
      where: { clientId: clientRecord.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ])

  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + Number(inv.outstandingAmount),
    0
  )

  // Serialize Decimal objects to numbers for client components
  const serializedInvoices = invoices.map(invoice => ({
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
  }))

  const stats = [
    {
      title: "Pending Compliance",
      value: pendingCompliance,
      icon: FileText,
      href: "/client/compliance",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      title: "Completed (30 days)",
      value: completedCompliance,
      icon: CheckCircle2,
      href: "/client/compliance",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Overdue Items",
      value: overdueCompliance,
      icon: AlertCircle,
      href: "/client/deadlines",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: "Outstanding Amount",
      value: `₹${totalOutstanding.toLocaleString("en-IN")}`,
      icon: Receipt,
      href: "/client/invoices",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of your compliance status and upcoming deadlines.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={cn("p-1.5 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("size-4", stat.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <Link href={stat.href}>
                <Button variant="link" className="h-auto p-0 mt-2 text-sm">
                  View details →
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="size-5" />
                  Upcoming Deadlines
                </CardTitle>
                <CardDescription>
                  Compliance deadlines in the next 14 days
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/client/deadlines">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="size-10 text-green-500/50 mb-3" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">
                  No upcoming deadlines in the next 14 days.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((deadline) => {
                  const daysUntil = Math.ceil(
                    (new Date(deadline.dueDate).getTime() - now.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                  return (
                    <div
                      key={deadline.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-10 items-center justify-center rounded-full",
                            daysUntil <= 3
                              ? "bg-red-500/10 text-red-500"
                              : daysUntil <= 7
                              ? "bg-yellow-500/10 text-yellow-500"
                              : "bg-green-500/10 text-green-500"
                          )}
                        >
                          <CalendarIcon className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {deadline.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {deadline.type.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            daysUntil <= 3
                              ? "destructive"
                              : daysUntil <= 7
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {daysUntil === 0
                            ? "Today"
                            : daysUntil === 1
                            ? "Tomorrow"
                            : `${daysUntil} days`}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(deadline.dueDate), "MMM d")}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity - Documents & Messages */}
        <div className="space-y-6">
          {/* Recent Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="size-5" />
                    Recent Documents
                  </CardTitle>
                  <CardDescription>
                    Recently uploaded or requested documents
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/client/documents">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Upload className="size-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium">No documents yet</p>
                  <p className="text-sm text-muted-foreground">
                    Documents will appear here when uploaded.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[150px]">
                            {doc.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.category}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(doc.createdAt), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="size-5" />
                    Recent Messages
                  </CardTitle>
                  <CardDescription>
                    Latest communication from your tax team
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/client/messages">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="size-10 text-muted-foreground/30 mb-3" />
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm text-muted-foreground">
                    Messages from your tax team will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <p className="text-sm line-clamp-2">{msg.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {msg.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Outstanding Invoices */}
      {serializedInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="size-5" />
                  Outstanding Invoices
                </CardTitle>
                <CardDescription>
                  Invoices requiring payment
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/client/invoices">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serializedInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full",
                        invoice.status === "OVERDUE"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-yellow-500/10 text-yellow-500"
                      )}
                    >
                      <Receipt className="size-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        Invoice #{invoice.invoiceNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ₹{Number(invoice.outstandingAmount).toLocaleString("en-IN")}
                    </p>
                    <Badge
                      variant={invoice.status === "OVERDUE" ? "destructive" : "secondary"}
                      className="text-xs mt-1"
                    >
                      {invoice.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}