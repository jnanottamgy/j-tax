import { redirect } from "next/navigation"
import { format } from "date-fns"
import { MessageSquare, Send, Clock, Check, X } from "lucide-react"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function ClientMessagesPage() {
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

  // Fetch messages for this client
  const messages = await prisma.message.findMany({
    where: { clientId: clientRecord.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <Check className="size-3 mr-1" />
            Delivered
          </Badge>
        )
      case "READ":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            Read
          </Badge>
        )
      case "FAILED":
        return (
          <Badge variant="destructive">
            <X className="size-3 mr-1" />
            Failed
          </Badge>
        )
      case "SENT":
        return (
          <Badge variant="secondary">
            <Send className="size-3 mr-1" />
            Sent
          </Badge>
        )
      default:
        return (
          <Badge variant="outline">
            <Clock className="size-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Communication history with your tax team.
        </p>
      </div>

      {/* Compose Message CTA */}
      <Card className="border-dashed border-2">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <MessageSquare className="size-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Send a Message</h3>
              <p className="text-sm text-muted-foreground">
                Have a question? Reach out to your tax team.
              </p>
            </div>
            <Button>
              <Send className="size-4 mr-2" />
              New Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-5" />
                Message History
              </CardTitle>
              <CardDescription>
                {messages.length} message{messages.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="size-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Messages from your tax team will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "p-4 rounded-lg border hover:shadow-md transition-shadow",
                    message.status === "FAILED" && "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <div className="flex items-center gap-3 mt-3">
                        {getStatusBadge(message.status)}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {message.status === "FAILED" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="size-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Response Time</p>
              <p className="text-sm text-muted-foreground mt-1">
                Our team typically responds within 24 business hours. For urgent matters, please call our office directly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}