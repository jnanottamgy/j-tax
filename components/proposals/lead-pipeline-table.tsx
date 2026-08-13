"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { MoreHorizontal, TrendingUp, ChevronDown, Trash2, FileText, Eye, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { updateLeadStatus, deleteLead, resolveLeadConversion, type getLeads } from "@/app/actions/proposals"

type Lead = Awaited<ReturnType<typeof getLeads>>[number]

const STATUSES = ["NEW_LEAD","CONTACTED","QUOTATION_REQUESTED","FOLLOW_UP_REQUIRED","CLIENT_WILL_REVERT","PROPOSAL_SENT","NEGOTIATION","WON","LOST"] as const
const STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead", CONTACTED: "Contacted", QUOTATION_REQUESTED: "Quotation Requested",
  FOLLOW_UP_REQUIRED: "Follow-Up Required", CLIENT_WILL_REVERT: "Client Will Revert",
  PROPOSAL_SENT: "Proposal Sent", NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
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

// The only lead statuses offered as filters + status-change options, with the
// user-facing labels. Other enum values still exist in the DB and render with
// their STATUS_LABELS badge, but are not selectable here.
const FILTER_STATUSES = [
  { value: "FOLLOW_UP_REQUIRED", label: "Follow-up required" },
  { value: "PROPOSAL_SENT", label: "Quotation sent" },
  { value: "WON", label: "Success" },
  { value: "LOST", label: "Reject" },
] as const

export function LeadPipelineTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads)
  const [filter, setFilter] = useState("ALL")
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Lead | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [, startTransition] = useTransition()
  const router = useRouter()

  const filtered = filter === "ALL" ? leads : leads.filter((l) => l.status === filter)

  // Rejecting a lead requires a reason — open the dialog instead of committing.
  function requestStatusChange(leadId: string, status: string) {
    if (status === "LOST") {
      const lead = leads.find((l) => l.id === leadId) ?? null
      setRejectReason("")
      setRejectTarget(lead)
      return
    }
    handleStatusChange(leadId, status)
  }

  function handleStatusChange(leadId: string, status: string, reason?: string) {
    const previous = leads
    // Optimistic — but roll back and tell the user if the server rejects it.
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: status as Lead["status"] } : l))
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, status, reason)
      if (result.error) {
        setLeads(previous)
        toast.error(result.error)
      } else {
        toast.success(`Lead moved to ${STATUS_LABELS[status] ?? status}`)
      }
    })
  }

  function confirmReject() {
    if (!rejectTarget) return
    handleStatusChange(rejectTarget.id, "LOST", rejectReason)
    setRejectTarget(null)
  }

  async function handleDeleteConfirmed() {
    const target = deleteTarget
    if (!target) return
    const result = await deleteLead(target.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      setLeads((prev) => prev.filter((l) => l.id !== target.id))
      toast.success(`Lead "${target.name}" deleted`)
    }
  }

  function handleConvert(leadId: string) {
    // Opens the prefilled Add Client dialog; the client is created there so the
    // details can be reviewed and the quoted services carried across.
    startTransition(async () => {
      const result = await resolveLeadConversion(leadId)
      if (result.href) router.push(result.href)
      else if (result.error) toast.error(result.error)
    })
  }

  const countByStatus = Object.fromEntries(
    STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length])
  )

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        <FilterPill label="All" count={leads.length} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        {FILTER_STATUSES.map((s) => (
          <FilterPill key={s.value} label={s.label} count={countByStatus[s.value] ?? 0} active={filter === s.value} onClick={() => setFilter(s.value)} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
          <TrendingUp className="size-8 opacity-30" />
          <p>No leads found. Add your first lead to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lead) => (
            <Card key={lead.id} className="border-white/[0.08]">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-x-4 gap-y-1 items-center">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.company || lead.email}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {lead.serviceRequired || <span className="opacity-40">—</span>}
                  </div>
                  <div className="text-xs">
                    {lead.estimatedValue
                      ? <span className="font-medium">₹{Number(lead.estimatedValue).toLocaleString("en-IN")}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {format(new Date(lead.createdAt), "dd MMM")}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[lead.status]}`}>
                        {STATUS_LABELS[lead.status]}
                      </Badge>
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {FILTER_STATUSES.map((s) => (
                      <DropdownMenuItem key={s.value} onClick={() => requestStatusChange(lead.id, s.value)}>
                        {s.label}
                        {lead.status === s.value && " ✓"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`More actions for ${lead.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/proposals/leads/${lead.id}`}>
                        <Eye className="size-3.5 mr-2" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/proposals/quotations/new?leadId=${lead.id}`}>
                        <FileText className="size-3.5 mr-2" />
                        Create Quotation
                      </Link>
                    </DropdownMenuItem>
                    {lead.status === "WON" && !lead.convertedClientId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleConvert(lead.id)}>
                          <UserPlus className="size-3.5 mr-2" />
                          Convert to Client
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteTarget(lead)}
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      Delete Lead
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this lead?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" and all of its quotations will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete lead"
        destructive
        onConfirm={handleDeleteConfirmed}
      />

      {/* Reject reason capture */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject lead</DialogTitle>
            <DialogDescription>
              {rejectTarget ? `Why is "${rejectTarget.name}" being rejected?` : ""}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Budget too low, chose another firm, not proceeding…"
            className="min-h-24"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={confirmReject}
            >
              Reject lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
        active
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-muted/30 text-muted-foreground border-white/5 hover:bg-muted/50"
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? "bg-primary/20" : "bg-white/10"}`}>
        {count}
      </span>
    </button>
  )
}
