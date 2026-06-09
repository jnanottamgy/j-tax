"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { MoreHorizontal, TrendingUp, ChevronDown, Trash2, FileText } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { updateLeadStatus, deleteLead, type getLeads } from "@/app/actions/proposals"

type Lead = Awaited<ReturnType<typeof getLeads>>[number]

const STATUSES = ["NEW_LEAD","CONTACTED","PROPOSAL_SENT","NEGOTIATION","WON","LOST"] as const
const STATUS_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead", CONTACTED: "Contacted", PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation", WON: "Won", LOST: "Lost",
}
const STATUS_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CONTACTED: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  PROPOSAL_SENT: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  NEGOTIATION: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  WON: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  LOST: "bg-red-500/10 text-red-400 border-red-500/20",
}

export function LeadPipelineTable({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads)
  const [filter, setFilter] = useState("ALL")
  const [, startTransition] = useTransition()

  const filtered = filter === "ALL" ? leads : leads.filter((l) => l.status === filter)

  function handleStatusChange(leadId: string, status: string) {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: status as Lead["status"] } : l))
    startTransition(async () => { await updateLeadStatus(leadId, status) })
  }

  function handleDelete(leadId: string) {
    setLeads((prev) => prev.filter((l) => l.id !== leadId))
    startTransition(async () => { await deleteLead(leadId) })
  }

  const countByStatus = Object.fromEntries(
    STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length])
  )

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        <FilterPill label="All" count={leads.length} active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        {STATUSES.map((s) => (
          <FilterPill key={s} label={STATUS_LABELS[s]} count={countByStatus[s]} active={filter === s} onClick={() => setFilter(s)} />
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
                    {STATUSES.map((s) => (
                      <DropdownMenuItem key={s} onClick={() => handleStatusChange(lead.id, s)}>
                        {STATUS_LABELS[s]}
                        {lead.status === s && " ✓"}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/proposals/quotations/new?leadId=${lead.id}`}>
                        <FileText className="size-3.5 mr-2" />
                        Create Quotation
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(lead.id)}
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
