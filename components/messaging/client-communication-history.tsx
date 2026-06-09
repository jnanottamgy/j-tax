"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Clock, MessageSquare, FileText, CheckCircle2, XCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface CommunicationHistoryProps {
  clientId: string
}

interface Message {
  id: string
  content: string
  status: string
  sentAt: Date
  template?: {
    name: string
    type: string
  }
  logs: Array<{
    status: string
    timestamp: Date
    details?: any
  }>
}

export function ClientCommunicationHistory({ clientId }: CommunicationHistoryProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      // TODO: Load actual messages from server
      // For now, we'll use mock data
      setMessages([
        {
          id: "1",
          content: "Reminder: Your GSTR-1 return is due on January 31st. Please ensure all documents are submitted.",
          status: "DELIVERED",
          sentAt: new Date(Date.now() - 86400000),
          template: {
            name: "GST Reminder",
            type: "COMPLIANCE_REMINDER",
          },
          logs: [
            { status: "PENDING", timestamp: new Date(Date.now() - 86400000) },
            { status: "QUEUED", timestamp: new Date(Date.now() - 86000000) },
            { status: "SENT", timestamp: new Date(Date.now() - 85000000) },
            { status: "DELIVERED", timestamp: new Date(Date.now() - 84000000) },
          ],
        },
        {
          id: "2",
          content: "Payment reminder: Invoice #INV-001 is pending payment of ₹50,000.",
          status: "READ",
          sentAt: new Date(Date.now() - 172800000),
          template: {
            name: "Payment Reminder",
            type: "PAYMENT_REMINDER",
          },
          logs: [
            { status: "PENDING", timestamp: new Date(Date.now() - 172800000) },
            { status: "QUEUED", timestamp: new Date(Date.now() - 172700000) },
            { status: "SENT", timestamp: new Date(Date.now() - 172600000) },
            { status: "DELIVERED", timestamp: new Date(Date.now() - 172500000) },
            { status: "READ", timestamp: new Date(Date.now() - 172400000) },
          ],
        },
      ])
    } catch (error) {
      console.error("Failed to load communication history:", error)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "SENT":
        return {
          icon: <MessageSquare className="h-4 w-4" />,
          color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          label: "Sent",
        }
      case "DELIVERED":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: "bg-green-500/10 text-green-400 border-green-500/20",
          label: "Delivered",
        }
      case "READ":
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          label: "Read",
        }
      case "FAILED":
        return {
          icon: <XCircle className="h-4 w-4" />,
          color: "bg-red-500/10 text-red-400 border-red-500/20",
          label: "Failed",
        }
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
          label: status,
        }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground">Loading communication history...</div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <Card className="bg-white/[0.02] border-white/[0.08] p-12 text-center">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No communication history found</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Communication History</h3>
        <Button variant="outline" size="sm" onClick={loadMessages}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {messages.map((message) => {
          const config = getStatusConfig(message.status)

          return (
            <Card key={message.id} className="bg-white/[0.02] border-white/[0.08] p-4">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {message.template?.name.charAt(0) || "M"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {message.template?.name || "Custom Message"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {message.template?.type || "CUSTOM"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.sentAt), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={config.color}>
                    {config.icon}
                    {config.label}
                  </Badge>
                </div>

                {/* Content */}
                <p className="text-sm bg-white/[0.02] border border-white/[0.08] rounded-lg p-3">
                  {message.content}
                </p>

                {/* Activity Timeline */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Activity Timeline</p>
                  <div className="space-y-1">
                    {message.logs.map((log, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="capitalize text-muted-foreground">{log.status.toLowerCase()}</span>
                        <span className="text-muted-foreground/70">•</span>
                        <span className="text-muted-foreground/70">
                          {format(new Date(log.timestamp), "h:mm a")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
