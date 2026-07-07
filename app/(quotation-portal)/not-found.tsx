import { FileQuestion } from "lucide-react"

export default function QuotationPortalNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-slate-100">
          <FileQuestion className="size-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Quotation not found</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          This quotation link is invalid or no longer available. If you believe
          this is a mistake, please contact the firm that sent you the quotation
          — reply to the original email or reach out to them directly.
        </p>
      </div>
    </div>
  )
}
