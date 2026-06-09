import { redirect } from "next/navigation"
import { format, addDays } from "date-fns"
import { Calendar, AlertCircle, CheckCircle2, Clock, Calendar as CalendarIcon } from "lucide-react"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function ClientDeadlinesPage() {
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

  // Fetch deadlines for this client
  const [complianceEvents, tasks] = await Promise.all([
    // Upcoming and overdue compliance events
    prisma.complianceEvent.findMany({
      where: {
        clientId: clientRecord.id,
        status: { in: ["PENDING", "OVERDUE"] },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    // Overdue tasks
    prisma.task.findMany({
      where: {
        clientId: clientRecord.id,
        status: { not: "FILED_DONE" },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
  ])

  // Categorize deadlines
  const today = complianceEvents.filter(
    (e) =>
      new Date(e.dueDate).toDateString() === now.toDateString()
  )

  const tomorrow = complianceEvents.filter(
    (e) =>
      new Date(e.dueDate).toDateString() === addDays(now, 1).toDateString()
  )

  const thisWeek = complianceEvents.filter(
    (e) => {
      const due = new Date(e.dueDate)
      const endOfWeek = addDays(now, 7)
      return due > now && due <= endOfWeek &&
        due.toDateString() !== now.toDateString() &&
        due.toDateString() !== addDays(now, 1).toDateString()
    }
  )

  const later = complianceEvents.filter(
    (e) => new Date(e.dueDate) > addDays(now, 7)
  )

  const overdue = [
    ...complianceEvents.filter((e) => e.status === "OVERDUE"),
    ...tasks.map((t) => ({
      ...t,
      title: t.title,
      type: "TASK" as const,
      isTask: true,
    })),
  ]

  function getDaysUntil(dueDate: Date): number {
    const due = new Date(dueDate)
    const diff = due.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  function getUrgencyColor(days: number): string {
    if (days < 0) return "text-red-500 bg-red-500/10"
    if (days <= 3) return "text-orange-500 bg-orange-500/10"
    if (days <= 7) return "text-yellow-500 bg-yellow-500/10"
    return "text-green-500 bg-green-500/10"
  }

  function getUrgencyLabel(days: number): string {
    if (days < 0) return `${Math.abs(days)} days overdue`
    if (days === 0) return "Due today"
    if (days === 1) return "Due tomorrow"
    return `Due in ${days} days`
  }

  const DeadlineSection = ({
    title,
    icon: Icon,
    items,
    emptyMessage,
  }: {
    title: string
    icon: any
    items: any[]
    emptyMessage: string
  }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-muted-foreground" />
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary" className="ml-auto">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground py-4">
            <CheckCircle2 className="size-5 text-green-500" />
            <span className="text-sm">{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const days = getDaysUntil(new Date(item.dueDate))
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors",
                    days < 0 && "bg-red-500/5 border border-red-500/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full",
                        getUrgencyColor(days)
                      )}
                    >
                      <CalendarIcon className="size-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.type ? item.type.replace(/_/g, " ") : "Compliance"}
                        {item.filingPeriod && ` • ${item.filingPeriod}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded",
                        getUrgencyColor(days)
                      )}
                    >
                      {getUrgencyLabel(days)}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.dueDate), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upcoming Deadlines</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Stay on top of your compliance deadlines and important dates.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={cn(overdue.length > 0 && "border-red-500/30")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-red-500/10">
              <AlertCircle className="size-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdue.length}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card className={cn(today.length > 0 && "border-orange-500/30")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Due Today
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Clock className="size-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{today.length}</div>
            <p className="text-xs text-muted-foreground">Deadline is today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-yellow-500/10">
              <Calendar className="size-4 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {today.length + tomorrow.length + thisWeek.length}
            </div>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Upcoming
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-green-500/10">
              <Calendar className="size-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {complianceEvents.length + tasks.length}
            </div>
            <p className="text-xs text-muted-foreground">All deadlines</p>
          </CardContent>
        </Card>
      </div>

      {/* Deadline Sections */}
      {overdue.length > 0 && (
        <DeadlineSection
          title="Overdue"
          icon={AlertCircle}
          items={overdue}
          emptyMessage="No overdue items - great job!"
        />
      )}

      <DeadlineSection
        title="Due Today"
        icon={Clock}
        items={today}
        emptyMessage="Nothing due today"
      />

      <DeadlineSection
        title="Due Tomorrow"
        icon={Calendar}
        items={tomorrow}
        emptyMessage="Nothing due tomorrow"
      />

      <DeadlineSection
        title="This Week"
        icon={Calendar}
        items={thisWeek}
        emptyMessage="No deadlines this week"
      />

      <DeadlineSection
        title="Later"
        icon={Calendar}
        items={later}
        emptyMessage="No upcoming deadlines"
      />

      {/* Info Banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Calendar className="size-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Stay Ahead</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload required documents early to ensure timely filing. If you need help with any deadline,
                please contact your tax team through the{" "}
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