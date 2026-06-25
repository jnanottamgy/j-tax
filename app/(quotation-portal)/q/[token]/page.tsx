import { notFound } from "next/navigation"
import { format } from "date-fns"
import { CheckCircle, XCircle, Clock, Eye, FileText } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { markQuotationViewed } from "@/app/actions/proposals"
import { getFirmSettings } from "@/lib/firm-settings"
import { QuotationResponseClient } from "./quotation-response-client"

export default async function QuotationPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const [quotation, cfg] = await Promise.all([
    prisma.quotation.findUnique({
      where: { token },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    getFirmSettings(),
  ])

  if (!quotation) notFound()

  // Mark as viewed if currently SENT
  if (quotation.status === "SENT") {
    await markQuotationViewed(token)
  }

  const isExpired = new Date(quotation.validUntil) < new Date()
  const canRespond = ["SENT", "VIEWED"].includes(quotation.status) && !isExpired

  const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    DRAFT: { label: "Draft", icon: FileText, color: "text-muted-foreground" },
    PENDING_APPROVAL: { label: "Pending Approval", icon: Clock, color: "text-yellow-500" },
    APPROVED: { label: "Approved", icon: CheckCircle, color: "text-blue-400" },
    SENT: { label: "Sent — Awaiting Response", icon: Clock, color: "text-blue-400" },
    VIEWED: { label: "Viewed — Awaiting Response", icon: Eye, color: "text-yellow-500" },
    ACCEPTED: { label: "Accepted", icon: CheckCircle, color: "text-emerald-500" },
    REJECTED: { label: "Rejected", icon: XCircle, color: "text-red-500" },
    EXPIRED: { label: "Expired", icon: XCircle, color: "text-muted-foreground" },
  }

  const statusCfg = STATUS_CONFIG[isExpired && quotation.status !== "ACCEPTED" ? "EXPIRED" : quotation.status] || STATUS_CONFIG.SENT
  const StatusIcon = statusCfg.icon

  function formatCurrency(n: number) {
    return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div style={{ background: "#1e3a8a" }} className="py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-widest">Quotation Portal</p>
            <h1 className="text-white text-xl font-bold mt-0.5">{cfg.firmName}</h1>
          </div>
          <div className="text-right">
            <p className="text-blue-200 text-xs">Quotation</p>
            <p className="text-white font-mono font-bold">#{quotation.quotationNumber}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Status Banner */}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border bg-white ${
          quotation.status === "ACCEPTED" ? "border-emerald-200 bg-emerald-50" :
          quotation.status === "REJECTED" ? "border-red-200 bg-red-50" :
          "border-slate-200"
        }`}>
          <StatusIcon className={`size-5 ${statusCfg.color}`} />
          <span className={`font-semibold text-sm ${statusCfg.color}`}>{statusCfg.label}</span>
          {isExpired && !["ACCEPTED","REJECTED"].includes(quotation.status) && (
            <span className="ml-auto text-xs text-muted-foreground">Expired on {format(new Date(quotation.validUntil), "dd MMM yyyy")}</span>
          )}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-0 border-b border-slate-100">
            {[
              { label: "Prepared For", value: quotation.clientCompany || quotation.clientName },
              { label: "Date Issued", value: format(new Date(quotation.createdAt), "dd MMM yyyy") },
              { label: "Valid Until", value: format(new Date(quotation.validUntil), "dd MMM yyyy") },
            ].map((m) => (
              <div key={m.label} className="px-5 py-4">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">{m.label}</p>
                <p className="font-semibold text-sm text-slate-800 mt-0.5">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#1e3a8a" }}>
                  <th className="text-left text-white text-xs font-semibold px-5 py-3">Service / Description</th>
                  <th className="text-center text-white text-xs font-semibold px-3 py-3 w-14">Qty</th>
                  <th className="text-right text-white text-xs font-semibold px-3 py-3 w-28">Unit Price</th>
                  <th className="text-right text-white text-xs font-semibold px-3 py-3 w-20">GST</th>
                  <th className="text-right text-white text-xs font-semibold px-5 py-3 w-32">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{item.description}</p>
                      {item.serviceType && <p className="text-xs text-slate-400 mt-0.5">{item.serviceType}</p>}
                    </td>
                    <td className="px-3 py-3.5 text-center text-slate-600">{item.quantity}</td>
                    <td className="px-3 py-3.5 text-right text-slate-600">{formatCurrency(Number(item.unitPrice))}</td>
                    <td className="px-3 py-3.5 text-right text-slate-400 text-xs">{Number(item.taxRate)}%</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-800">{formatCurrency(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-5 py-4 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span>{formatCurrency(Number(quotation.subtotal))}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>GST / Tax</span>
              <span>{formatCurrency(Number(quotation.taxAmount))}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-100" style={{ color: "#1e3a8a" }}>
              <span>Total Amount</span>
              <span>{formatCurrency(Number(quotation.total))}</span>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-600">{quotation.notes}</p>
            </div>
          )}

          {/* Terms */}
          <div className="px-5 py-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Terms & Conditions</p>
            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
              {quotation.terms ||
                "1. This quotation is valid for 30 days from date of issue.\n2. 50% advance required to commence services.\n3. Prices are inclusive of GST as stated.\n4. Work commences upon signed acceptance."}
            </p>
          </div>
        </div>

        {/* Response Actions */}
        <QuotationResponseClient
          token={token}
          canRespond={canRespond}
          currentStatus={quotation.status}
          pdfUrl={null}
        />

        <p className="text-center text-xs text-slate-400 pb-4">
          {cfg.fromEmail && (
            <>Questions? Contact us at{" "}
              <a href={`mailto:${cfg.replyToEmail || cfg.fromEmail}`} className="underline">
                {cfg.replyToEmail || cfg.fromEmail}
              </a>
              {cfg.firmPhone ? <> &nbsp;|&nbsp; {cfg.firmPhone}</> : null}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
