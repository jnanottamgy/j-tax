"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Download, Send, CheckCircle2, XCircle, Clock, Eye,
  Copy, ExternalLink, FileText, Mail, AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { approveAndSendQuotation, deleteQuotation, type getQuotationById } from "@/app/actions/proposals"

type Quotation = NonNullable<Awaited<ReturnType<typeof getQuotationById>>>

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  DRAFT: { label: "Draft", icon: FileText, cls: "bg-muted/30 text-muted-foreground border-white/10" },
  PENDING_APPROVAL: { label: "Pending Approval", icon: Clock, cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  APPROVED: { label: "Approved", icon: CheckCircle2, cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  SENT: { label: "Sent", icon: Send, cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  VIEWED: { label: "Viewed", icon: Eye, cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  ACCEPTED: { label: "Accepted ✓", icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  REJECTED: { label: "Rejected", icon: XCircle, cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  EXPIRED: { label: "Expired", icon: AlertCircle, cls: "bg-muted/30 text-muted-foreground border-white/10" },
}

export function QuotationDetailClient({
  quotation,
  isPartner,
}: {
  quotation: Quotation
  isPartner: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/q/${quotation.token}`

  const isExpired = new Date(quotation.validUntil) < new Date() && !["ACCEPTED", "REJECTED"].includes(quotation.status)
  const cfg = STATUS_CONFIG[isExpired ? "EXPIRED" : quotation.status] ?? STATUS_CONFIG.DRAFT
  const StatusIcon = cfg.icon

  const canApproveAndSend = isPartner && ["PENDING_APPROVAL", "APPROVED", "DRAFT"].includes(quotation.status) && !isExpired

  async function handleApproveAndSend() {
    setIsSending(true)
    setSendError(null)
    startTransition(async () => {
      const result = await approveAndSendQuotation(quotation.id)
      setIsSending(false)
      if (result.error) setSendError(result.error)
      else router.refresh()
    })
  }

  async function handleDelete() {
    if (!confirm("Delete this quotation? This cannot be undone.")) return
    startTransition(async () => {
      const result = await deleteQuotation(quotation.id)
      if (result.error) alert(result.error)
      else router.push("/proposals")
    })
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  function formatCurrency(n: number) {
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="mt-6 space-y-5">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`gap-1 ${cfg.cls}`}>
          <StatusIcon className="size-3.5" />
          {cfg.label}
        </Badge>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {quotation.status !== "DRAFT" && (
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="size-3.5 mr-1.5" />
              {copiedLink ? "Copied!" : "Copy Link"}
            </Button>
          )}
          {quotation.status !== "DRAFT" && (
            <Button size="sm" variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5 mr-1.5" />
                Preview
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`/api/quotations/${quotation.id}/pdf`} download>
              <Download className="size-3.5 mr-1.5" />
              Download PDF
            </a>
          </Button>
          {canApproveAndSend && (
            <Button size="sm" onClick={handleApproveAndSend} disabled={isSending}>
              <Send className="size-3.5 mr-1.5" />
              {isSending ? "Sending…" : "Approve & Send"}
            </Button>
          )}
          {["DRAFT", "PENDING_APPROVAL"].includes(quotation.status) && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {sendError && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {sendError}
        </div>
      )}

      {!isPartner && quotation.status === "PENDING_APPROVAL" && (
        <div className="px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-500 flex items-center gap-2">
          <Clock className="size-4 shrink-0" />
          This quotation is awaiting Partner approval before it can be sent to the client.
        </div>
      )}

      {quotation.status === "ACCEPTED" && (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-500 flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          Client accepted this quotation on {quotation.respondedAt ? format(new Date(quotation.respondedAt), "dd MMM yyyy 'at' HH:mm") : "—"}.
        </div>
      )}

      {quotation.status === "REJECTED" && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          <div className="flex items-center gap-2">
            <XCircle className="size-4 shrink-0" />
            Client declined on {quotation.respondedAt ? format(new Date(quotation.respondedAt), "dd MMM yyyy") : "—"}.
          </div>
          {quotation.rejectionReason && (
            <p className="mt-1 ml-6 text-xs opacity-80">Reason: {quotation.rejectionReason}</p>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left: quotation content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Client + meta */}
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-5">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bill To</p>
                <p className="font-semibold">{quotation.clientCompany || quotation.clientName}</p>
                <p className="text-sm text-muted-foreground">{quotation.clientName}</p>
                <p className="text-sm text-muted-foreground">{quotation.clientEmail}</p>
                {quotation.clientPhone && <p className="text-sm text-muted-foreground">{quotation.clientPhone}</p>}
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Issued" value={format(new Date(quotation.createdAt), "dd MMM yyyy")} />
                <Row label="Valid Until" value={format(new Date(quotation.validUntil), "dd MMM yyyy")} />
                {quotation.sentAt && <Row label="Sent" value={format(new Date(quotation.sentAt), "dd MMM yyyy HH:mm")} />}
                {quotation.viewedAt && <Row label="Viewed" value={format(new Date(quotation.viewedAt), "dd MMM yyyy HH:mm")} />}
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2.5">Description</th>
                      <th className="text-center text-xs text-muted-foreground font-medium px-3 py-2.5 w-16">Qty</th>
                      <th className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5 w-28">Unit Price</th>
                      <th className="text-right text-xs text-muted-foreground font-medium px-3 py-2.5 w-20">GST</th>
                      <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2.5 w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotation.items.map((item) => (
                      <tr key={item.id} className="border-b border-white/[0.04]">
                        <td className="px-4 py-3">
                          <p className="font-medium">{item.description}</p>
                          {item.serviceType && <p className="text-xs text-muted-foreground">{item.serviceType}</p>}
                        </td>
                        <td className="px-3 py-3 text-center text-muted-foreground">{item.quantity}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{formatCurrency(Number(item.unitPrice))}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground text-xs">{Number(item.taxRate)}%</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-4 border-t border-white/[0.06] space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(Number(quotation.subtotal))}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>GST / Tax</span>
                  <span>{formatCurrency(Number(quotation.taxAmount))}</span>
                </div>
                <Separator className="my-2 bg-white/[0.06]" />
                <div className="flex justify-between font-bold text-base text-primary">
                  <span>Total</span>
                  <span>{formatCurrency(Number(quotation.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {quotation.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{quotation.notes}</p></CardContent>
            </Card>
          )}
        </div>

        {/* Right: timeline + follow-ups */}
        <div className="space-y-5">
          {/* Email history */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mail className="size-4" />
                Email History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quotation.emailLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No emails sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {quotation.emailLogs.map((log) => (
                    <div key={log.id} className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${log.status === "SENT" ? "text-emerald-500 border-emerald-500/20" : "text-red-500 border-red-500/20"}`}>
                          {log.status}
                        </Badge>
                        <span className="text-muted-foreground capitalize">{log.emailType.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-muted-foreground">{format(new Date(log.sentAt), "dd MMM yyyy HH:mm")}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Follow-up schedule */}
          {quotation.followUps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Follow-up Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {quotation.followUps.map((fu) => (
                    <div key={fu.id} className="flex items-center gap-2 text-xs">
                      <div className={`size-2 rounded-full ${
                        fu.status === "SENT" ? "bg-emerald-500" :
                        fu.status === "SKIPPED" ? "bg-muted-foreground/30" : "bg-yellow-500"
                      }`} />
                      <span>Day {fu.followUpDay}</span>
                      <span className="text-muted-foreground">{format(new Date(fu.scheduledAt), "dd MMM")}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{fu.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Public link */}
          {quotation.status !== "DRAFT" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Client Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Share this link with the client to view and respond to the quotation.</p>
                <div className="flex gap-2">
                  <code className="flex-1 truncate text-xs bg-muted/30 px-2 py-1.5 rounded">/q/{quotation.token.slice(0, 12)}…</code>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={copyLink}>
                    {copiedLink ? "✓" : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
