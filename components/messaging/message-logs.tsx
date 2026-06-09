"use client"

import { format } from "date-fns"
import { Clock, CheckCircle2, XCircle, AlertCircle, Send } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MessageLogsProps {
  logs?: any[]
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  PENDING: {
    icon: <Clock className="h-4 w-4" />,
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    label: "Pending",
  },
  QUEUED: {
    icon: <Clock className="h-4 w-4" />,
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    label: "Queued",
  },
  SENT: {
    icon: <Send className="h-4 w-4" />,
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    label: "Sent",
  },
  DELIVERED: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-green-500/10 text-green-400 border-green-500/20",
    label: "Delivered",
  },
  READ: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    label: "Read",
  },
  FAILED: {
    icon: <XCircle className="h-4 w-4" />,
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    label: "Failed",
  },
  RETRYING: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    label: "Retrying",
  },
}

export function MessageLogs({ logs = [] }: MessageLogsProps) {
  if (logs.length === 0) {
    return (
      <Card className="bg-white/[0.02] border-white/[0.08] p-12 text-center">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No message logs available</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Message Logs</h3>
      <div className="space-y-2">
        {logs.map((log) => {
          const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.PENDING

          return (
            <Card key={log.id} className="bg-white/[0.02] border-white/[0.08] p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn("p-2 rounded-lg", config.color)}>
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.message?.client?.name || "Unknown"}</span>
                      <Badge variant="outline" className={config.color}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{log.message?.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(log.timestamp), "MMM d, yyyy h:mm a")}</span>
                      {log.details?.action && (
                        <span>• {log.details.action}</span>
                      )}
                    </div>
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
