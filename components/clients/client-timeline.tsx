"use client"

import { format } from "date-fns"
import {
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  Receipt,
  Shield,
  Target,
  Upload,
  UserPlus,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  LEAD_CREATED: { icon: Target, color: "text-blue-400", label: "Lead" },
  LEAD_STATUS_CHANGED: { icon: Target, color: "text-blue-400", label: "Lead" },
  QUOTATION_CREATED: { icon: FileText, color: "text-purple-400", label: "Quotation" },
  QUOTATION_SENT: { icon: Mail, color: "text-purple-400", label: "Quotation" },
  QUOTATION_ACCEPTED: { icon: CheckCircle2, color: "text-emerald-400", label: "Quotation" },
  QUOTATION_REJECTED: { icon: FileText, color: "text-red-400", label: "Quotation" },
  CLIENT_ONBOARDED: { icon: UserPlus, color: "text-emerald-400", label: "Client" },
  DOCUMENT_UPLOADED: { icon: Upload, color: "text-cyan-400", label: "Document" },
  DOCUMENT_REQUESTED: { icon: FileText, color: "text-amber-400", label: "Document" },
  TASK_CREATED: { icon: Clock, color: "text-blue-400", label: "Task" },
  TASK_COMPLETED: { icon: CheckCircle2, color: "text-emerald-400", label: "Task" },
  COMPLIANCE_FILED: { icon: Shield, color: "text-emerald-400", label: "Compliance" },
  COMPLIANCE_OVERDUE: { icon: Shield, color: "text-red-400", label: "Compliance" },
  INVOICE_CREATED: { icon: Receipt, color: "text-purple-400", label: "Invoice" },
  INVOICE_SENT: { icon: Mail, color: "text-purple-400", label: "Invoice" },
  PAYMENT_RECEIVED: { icon: Wallet, color: "text-emerald-400", label: "Payment" },
  EMAIL_SENT: { icon: Mail, color: "text-blue-400", label: "Email" },
  NOTE_ADDED: { icon: FileText, color: "text-slate-400", label: "Note" },
  EMPLOYEE_ASSIGNED: { icon: UserPlus, color: "text-blue-400", label: "Assignment" },
}

interface TimelineEvent {
  id: string
  eventType: string
  title: string
  description: string | null
  createdAt: string | Date
  performedBy?: string | null
}

export function ClientTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="size-4" />
            Client Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No timeline events yet. Activity will appear here as you work with this client.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="size-4" />
          Client Timeline
          <Badge variant="outline" className="ml-auto text-[10px]">{events.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {events.map((event, i) => {
            const config = EVENT_CONFIG[event.eventType] || { icon: Clock, color: "text-muted-foreground", label: "Activity" }
            const Icon = config.icon

            return (
              <div key={event.id} className="flex gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <div className={`flex size-7 items-center justify-center rounded-full bg-muted/30 ${config.color}`}>
                    <Icon className="size-3.5" />
                  </div>
                  {i < events.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {config.label}
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {format(new Date(event.createdAt), "dd MMM yyyy, h:mm a")}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
