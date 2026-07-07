"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Download, Send, CheckCircle2, XCircle, Clock, Eye,
  Copy, ExternalLink, FileText, Mail, AlertCircle, Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  QuotationDocument,
  type QuotationDocumentFirm,
} from "@/components/proposals/quotation-document"
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
  firm,
}: {
  quotation: Quotation
  isPartner: boolean
  firm: QuotationDocumentFirm
}) {
  const router = useRouter()
  const [sendError, setSendError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [confirmingSend, setConfirmingSend] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const _APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/q/${quotation.token}`

  const isExpired = new Date(quotation.validUntil) < new Date() && !["ACCEPTED", "REJECTED"].includes(quotation.status)
  const cfg = STATUS_CONFIG[isExpired ? "EXPIRED" : quotation.status] ?? STATUS_CONFIG.DRAFT
  const StatusIcon = cfg.icon

  const canApproveAndSend = isPartner && ["PENDING_APPROVAL", "APPROVED", "DRAFT"].includes(quotation.status) && !isExpired

  async function handleApproveAndSend() {
    setSendError(null)
    const result = await approveAndSendQuotation(quotation.id)
    if (result.error) {
      setSendError(result.error)
    } else {
      toast.success(`Quotation sent to ${quotation.clientEmail}`)
      router.refresh()
    }
  }

  async function handleDelete() {
    const result = await deleteQuotation(quotation.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      router.push("/proposals")
    }
  }

  async function handleDownloadPdf() {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/pdf`)
      if (!res.ok) {
        toast.error(
          res.status === 429
            ? "Too many downloads — wait a minute"
            : "Failed to download PDF — please try again."
        )
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Quotation-${quotation.quotationNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to download PDF — please try again.")
    } finally {
      setIsDownloading(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
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
          <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="size-3.5 mr-1.5" />
            )}
            Download PDF
          </Button>
          {canApproveAndSend && (
            <Button size="sm" onClick={() => setConfirmingSend(true)}>
              <Send className="size-3.5 mr-1.5" />
              Approve & Send
            </Button>
          )}
          {["DRAFT", "PENDING_APPROVAL"].includes(quotation.status) && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingSend}
        onOpenChange={setConfirmingSend}
        title="Approve & send quotation?"
        description={`Send this quotation to ${quotation.clientEmail}? The client is emailed immediately and the quotation is locked.`}
        confirmLabel="Approve & Send"
        onConfirm={handleApproveAndSend}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete quotation?"
        description="Delete this quotation? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />

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
        {/* Left: the client-ready document exactly as the client sees it */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Client-ready preview — this is exactly what {quotation.clientName} sees.
            </span>
            <span className="hidden sm:flex items-center gap-3">
              {quotation.sentAt && <span>Sent {format(new Date(quotation.sentAt), "dd MMM HH:mm")}</span>}
              {quotation.viewedAt && <span>Viewed {format(new Date(quotation.viewedAt), "dd MMM HH:mm")}</span>}
            </span>
          </div>
          <QuotationDocument
            firm={firm}
            quotation={{
              number: quotation.quotationNumber,
              issuedAt: quotation.createdAt,
              validUntil: quotation.validUntil,
              clientName: quotation.clientName,
              clientCompany: quotation.clientCompany,
              clientEmail: quotation.clientEmail,
              clientPhone: quotation.clientPhone,
              items: quotation.items.map((item) => ({
                id: item.id,
                description: item.description,
                serviceType: item.serviceType,
                fee: Number(item.unitPrice) * item.quantity,
                taxRate: Number(item.taxRate),
                taxAmount: Number(item.taxAmount),
                total: Number(item.total),
              })),
              subtotal: Number(quotation.subtotal),
              taxAmount: Number(quotation.taxAmount),
              total: Number(quotation.total),
              notes: quotation.notes,
              terms: quotation.terms,
              acceptance: ["ACCEPTED", "REJECTED"].includes(quotation.status)
                ? {
                    status: quotation.status as "ACCEPTED" | "REJECTED",
                    respondedAt: quotation.respondedAt,
                  }
                : null,
            }}
          />
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
