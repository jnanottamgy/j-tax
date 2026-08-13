import { notFound } from "next/navigation"
import { format } from "date-fns"
import { CheckCircle, XCircle, Clock, Eye, FileText, Download } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { markQuotationViewed } from "@/app/actions/proposals"
import { getFirmSettingsForFirm } from "@/lib/firm-settings"
import { QuotationDocument } from "@/components/proposals/quotation-document"
import { PrintButton } from "@/components/proposals/print-button"
import { QuotationResponseClient } from "./quotation-response-client"

export default async function QuotationPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Public route — no session, so the firm cannot be derived from the request.
  // Resolve it from the quotation itself, otherwise the prospect sees the
  // platform defaults instead of the firm's own letterhead.
  const quotation = await prisma.quotation.findUnique({
    where: { token },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  })

  if (!quotation) notFound()

  const cfg = await getFirmSettingsForFirm(quotation.firmId)

  // Mark as viewed if currently SENT
  if (quotation.status === "SENT") {
    await markQuotationViewed(token)
  }

  const isExpired = new Date(quotation.validUntil) < new Date()
  const canRespond = ["SENT", "VIEWED"].includes(quotation.status) && !isExpired

  const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    DRAFT: { label: "Draft", icon: FileText, color: "text-slate-500" },
    PENDING_APPROVAL: { label: "Pending Approval", icon: Clock, color: "text-yellow-600" },
    APPROVED: { label: "Approved", icon: CheckCircle, color: "text-blue-600" },
    SENT: { label: "Sent — Awaiting Response", icon: Clock, color: "text-blue-600" },
    VIEWED: { label: "Viewed — Awaiting Response", icon: Eye, color: "text-yellow-600" },
    ACCEPTED: { label: "Accepted", icon: CheckCircle, color: "text-emerald-600" },
    REJECTED: { label: "Rejected", icon: XCircle, color: "text-red-600" },
    EXPIRED: { label: "Expired", icon: XCircle, color: "text-slate-500" },
  }

  const statusCfg = STATUS_CONFIG[isExpired && quotation.status !== "ACCEPTED" ? "EXPIRED" : quotation.status] || STATUS_CONFIG.SENT
  const StatusIcon = statusCfg.icon

  const documentData = {
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
  }

  return (
    <div className="min-h-screen bg-slate-100" style={{ colorScheme: "light" }}>
      {/* Header — hidden when printing so only the document prints */}
      <div style={{ background: "#1e3a8a" }} className="py-6 px-4 print:hidden">
        <div className="max-w-[820px] mx-auto flex items-center justify-between">
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

      <div className="max-w-[820px] mx-auto px-4 py-8 space-y-6 print:max-w-none print:p-0 print:space-y-0">
        {/* Status + actions bar */}
        <div className="flex items-stretch gap-3 print:hidden">
          <div className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border bg-white ${
            quotation.status === "ACCEPTED" ? "border-emerald-200 bg-emerald-50" :
            quotation.status === "REJECTED" ? "border-red-200 bg-red-50" :
            "border-slate-200"
          }`}>
            <StatusIcon className={`size-5 ${statusCfg.color}`} />
            <span className={`font-semibold text-sm ${statusCfg.color}`}>{statusCfg.label}</span>
            {isExpired && !["ACCEPTED","REJECTED"].includes(quotation.status) && (
              <span className="ml-auto text-xs text-slate-400">Expired on {format(new Date(quotation.validUntil), "dd MMM yyyy")}</span>
            )}
          </div>
          <PrintButton />
          <a
            href={`/api/quotations/public/${token}/pdf`}
            download
            className="shrink-0 inline-flex items-center gap-2 px-4 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Download className="size-4" />
            Download PDF
          </a>
        </div>

        {/* The document itself */}
        <QuotationDocument
          firm={{
            name: cfg.firmName,
            address: cfg.firmAddress,
            phone: cfg.firmPhone,
            email: cfg.replyToEmail || cfg.fromEmail || null,
            gstin: cfg.gstin,
            website: cfg.website,
          }}
          quotation={documentData}
        />

        {/* Response actions */}
        <div className="print:hidden space-y-6">
          {isExpired && !["ACCEPTED", "REJECTED"].includes(quotation.status) && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500">
                This quotation has expired — reply to the original email or contact
                us to request an updated one.
              </p>
            </div>
          )}
          <QuotationResponseClient
            token={token}
            canRespond={canRespond}
            currentStatus={quotation.status}
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
    </div>
  )
}
