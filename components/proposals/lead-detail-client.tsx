"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  ArrowRight,
  Building2,
  Clock,
  FileText,
  Mail,
  Pencil,
  Phone,
  Plus,
  UserPlus,
} from "lucide-react"

import { WhatsAppButton } from "@/components/messaging/whatsapp-button"
import { draftLeadFollowUp } from "@/lib/messaging/whatsapp-drafts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { updateLeadStatus, resolveLeadConversion } from "@/app/actions/proposals"
import { EditLeadDialog } from "@/components/proposals/edit-lead-dialog"

// The lead statuses selectable in the UI (others still render via STATUS_LABELS).
const STATUS_OPTIONS = [
  { value: "FOLLOW_UP_REQUIRED", label: "Follow-up required" },
  { value: "PROPOSAL_SENT", label: "Quotation sent" },
  { value: "WON", label: "Success" },
  { value: "LOST", label: "Reject" },
] as const

const STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  QUOTATION_REQUESTED: "Quotation Requested",
  FOLLOW_UP_REQUIRED: "Follow-Up Required",
  CLIENT_WILL_REVERT: "Client Will Revert",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
}

const STATUS_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CONTACTED: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  QUOTATION_REQUESTED: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  FOLLOW_UP_REQUIRED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CLIENT_WILL_REVERT: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  PROPOSAL_SENT: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  NEGOTIATION: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  WON: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  LOST: "bg-red-500/10 text-red-400 border-red-500/20",
}

const SOURCE_LABELS: Record<string, string> = {
  REFERRAL: "Referral",
  WEBSITE: "Website",
  WALK_IN: "Walk-In",
  COLD_CALL: "Cold Call",
  SOCIAL_MEDIA: "Social Media",
  OTHER: "Other",
}

interface Props {
  lead: {
    id: string
    name: string
    email: string
    phone: string | null
    company: string | null
    serviceRequired: string | null
    source: string
    status: string
    estimatedValue: number | null
    notes: string | null
    rejectionReason: string | null
    assignedTo: string | null
    convertedClientId: string | null
    createdAt: string | Date
    updatedAt: string | Date
    quotations: Array<{
      id: string
      quotationNumber: string
      status: string
      total: number
      sentAt: string | Date | null
      respondedAt: string | Date | null
      createdAt: string | Date
      items: Array<{ description: string; total: number }>
      emailLogs: Array<{ emailType: string; status: string; sentAt: string | Date }>
    }>
    timelineEvents: Array<{
      id: string
      eventType: string
      title: string
      description: string | null
      createdAt: string | Date
    }>
  }
  employees: Array<{ id: string; name: string; userId: string | null }>
}

export function LeadDetailClient({ lead, employees }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState(lead.status)
  const [editOpen, setEditOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState(lead.rejectionReason ?? "")
  const [isPending, startTransition] = useTransition()

  function handleStatusChange(newStatus: string) {
    // Rejecting requires a reason — open the dialog instead of committing.
    if (newStatus === "LOST") {
      setRejectOpen(true)
      return
    }
    setStatus(newStatus)
    startTransition(async () => {
      await updateLeadStatus(lead.id, newStatus)
    })
  }

  function confirmReject() {
    setStatus("LOST")
    setRejectOpen(false)
    startTransition(async () => {
      await updateLeadStatus(lead.id, "LOST", rejectReason)
    })
  }

  function handleConvert() {
    // Navigates to the prefilled Add Client dialog rather than creating the
    // client outright — the partner reviews the details first, and services
    // arrive locked to the accepted quotation when there is one.
    startTransition(async () => {
      const result = await resolveLeadConversion(lead.id)
      if (result.href) router.push(result.href)
      else if (result.error) toast.error(result.error)
    })
  }

  const assignedEmployee = employees.find((e) => e.id === lead.assignedTo || e.userId === lead.assignedTo)

  return (
    <div className="mt-6 space-y-6">
      {/* Status + Actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={status} onValueChange={handleStatusChange} disabled={isPending}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5 mr-1" />
          Edit
        </Button>

        {/* First touch on WhatsApp, with the service they asked about. */}
        <WhatsAppButton
          size="sm"
          contact={lead}
          message={draftLeadFollowUp({
            leadName: lead.name,
            service: lead.serviceRequired,
          })}
        />

        <Button size="sm" variant="outline" asChild>
          <Link href={`/proposals/quotations/new?leadId=${lead.id}`}>
            <Plus className="size-3.5 mr-1" />
            New Quotation
          </Link>
        </Button>

        {status === "WON" && !lead.convertedClientId && (
          <Button size="sm" onClick={handleConvert} disabled={isPending}>
            <UserPlus className="size-3.5 mr-1" />
            Convert to Client
          </Button>
        )}

        {lead.convertedClientId && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/clients/${lead.convertedClientId}`}>
              <ArrowRight className="size-3.5 mr-1" />
              View Client
            </Link>
          </Button>
        )}
      </div>

      {status === "LOST" && lead.rejectionReason && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-sm">
          <span className="font-medium text-red-400">Rejection reason: </span>
          <span className="text-muted-foreground">{lead.rejectionReason}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lead Info */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Lead Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 text-muted-foreground" />
              <span>{lead.email}</span>
            </div>
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.company && (
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span>{lead.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Enquiry: {format(new Date(lead.createdAt), "dd MMM yyyy")}</span>
            </div>
            <div className="border-t pt-3 mt-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span>{SOURCE_LABELS[lead.source] || lead.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span>{lead.serviceRequired || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Value</span>
                <span>{lead.estimatedValue ? `₹${lead.estimatedValue.toLocaleString("en-IN")}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span>{assignedEmployee?.name || "Unassigned"}</span>
              </div>
            </div>
            {lead.notes && (
              <div className="border-t pt-3 mt-3">
                <p className="text-muted-foreground text-xs mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotations + Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quotations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4" />
                Quotations ({lead.quotations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.quotations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quotations yet.</p>
              ) : (
                <div className="space-y-3">
                  {lead.quotations.map((q) => (
                    <Link
                      key={q.id}
                      href={`/proposals/quotations/${q.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/[0.08] hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{q.quotationNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(q.createdAt), "dd MMM yyyy")}
                          {q.items.length > 0 && ` — ${q.items.length} items`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">₹{q.total.toLocaleString("en-IN")}</span>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[q.status] || ""}`}>
                          {q.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="size-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.timelineEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No timeline events yet.</p>
              ) : (
                <div className="relative space-y-0">
                  {lead.timelineEvents.map((event, i) => (
                    <div key={event.id} className="flex gap-3 pb-4">
                      <div className="flex flex-col items-center">
                        <div className="size-2 rounded-full bg-primary mt-2" />
                        {i < lead.timelineEvents.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-2">
                        <p className="text-sm font-medium">{event.title}</p>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {format(new Date(event.createdAt), "dd MMM yyyy, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EditLeadDialog
        lead={lead}
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          router.refresh()
        }}
      />

      {/* Reject reason capture */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject lead</DialogTitle>
            <DialogDescription>Why is “{lead.name}” being rejected?</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Budget too low, chose another firm, not proceeding…"
            className="min-h-24"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!rejectReason.trim()} onClick={confirmReject}>
              Reject lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
