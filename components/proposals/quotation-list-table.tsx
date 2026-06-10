"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Eye, Download, Send, Clock, CheckCircle2, XCircle, FileText, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { getQuotations } from "@/app/actions/proposals"

type Quotation = Awaited<ReturnType<typeof getQuotations>>[number]

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  DRAFT: { label: "Draft", icon: FileText, cls: "bg-muted/30 text-muted-foreground border-white/10" },
  PENDING_APPROVAL: { label: "Pending Approval", icon: Clock, cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  APPROVED: { label: "Approved", icon: CheckCircle2, cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  SENT: { label: "Sent", icon: Send, cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  VIEWED: { label: "Viewed", icon: Eye, cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  ACCEPTED: { label: "Accepted", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  REJECTED: { label: "Rejected", icon: XCircle, cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  EXPIRED: { label: "Expired", icon: AlertCircle, cls: "bg-muted/30 text-muted-foreground border-white/10" },
}

export function QuotationListTable({ initialQuotations }: { initialQuotations: Quotation[] }) {
  const [filter, setFilter] = useState("ALL")

  const filtered = filter === "ALL" ? initialQuotations : initialQuotations.filter((q) => q.status === filter)

  const counts: Record<string, number> = { ALL: initialQuotations.length }
  for (const q of initialQuotations) counts[q.status] = (counts[q.status] ?? 0) + 1

  const filterOptions = ["ALL", "DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "VIEWED", "ACCEPTED", "REJECTED"]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((s) => {
          const cfg = s === "ALL" ? null : STATUS_CONFIG[s]
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                filter === s
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-muted/30 text-muted-foreground border-white/5 hover:bg-muted/50"
              }`}
            >
              {cfg ? cfg.label : "All"}
              <span className="px-1.5 rounded-full text-[10px] bg-white/10">{counts[s] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
          <FileText className="size-8 opacity-30" />
          <p>No quotations found. <Link href="/proposals/quotations/new" className="text-primary underline">Create one</Link>.</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">Quotation</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-3 py-3">Client</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-3 py-3">Total</th>
                    <th className="text-center text-xs text-muted-foreground font-medium px-3 py-3">Status</th>
                    <th className="text-left text-xs text-muted-foreground font-medium px-3 py-3">Valid Until</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((q) => {
                    const cfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.DRAFT
                    const Icon = cfg.icon
                    const isExpired = new Date(q.validUntil) < new Date() && !["ACCEPTED", "REJECTED"].includes(q.status)

                    return (
                      <tr key={q.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/proposals/quotations/${q.id}`} className="font-medium hover:text-primary transition-colors">
                            #{q.quotationNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">{format(new Date(q.createdAt), "dd MMM yyyy")}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium truncate max-w-[160px]">{q.clientName}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{q.clientCompany || q.clientEmail}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          ₹{Number(q.total).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${isExpired ? STATUS_CONFIG.EXPIRED.cls : cfg.cls}`}>
                            <Icon className="size-3" />
                            {isExpired ? "Expired" : cfg.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {format(new Date(q.validUntil), "dd MMM yyyy")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                              <Link href={`/proposals/quotations/${q.id}`}>
                                <Eye className="size-3.5" />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                              <a href={`/api/quotations/${q.id}/pdf`} download>
                                <Download className="size-3.5" />
                              </a>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
