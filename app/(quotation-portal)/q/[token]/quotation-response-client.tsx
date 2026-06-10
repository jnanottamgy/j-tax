"use client"

import { useState, useTransition } from "react"
import { CheckCircle, XCircle, MessageSquare, Loader2 } from "lucide-react"
import { respondToQuotation } from "@/app/actions/proposals"

type Props = {
  token: string
  canRespond: boolean
  currentStatus: string
  pdfUrl: string | null
}

export function QuotationResponseClient({ token, canRespond, currentStatus }: Props) {
  const [, startTransition] = useTransition()
  const [done, setDone] = useState<"ACCEPTED" | "REJECTED" | null>(
    currentStatus === "ACCEPTED" ? "ACCEPTED" : currentStatus === "REJECTED" ? "REJECTED" : null
  )
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done === "ACCEPTED") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle className="size-10 text-emerald-500 mx-auto mb-3" />
        <h3 className="font-bold text-emerald-700 text-lg">Quotation Accepted</h3>
        <p className="text-sm text-emerald-600 mt-1">
          Thank you! Our team will be in touch shortly to begin the engagement.
        </p>
      </div>
    )
  }

  if (done === "REJECTED") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <XCircle className="size-10 text-red-400 mx-auto mb-3" />
        <h3 className="font-bold text-red-700 text-lg">Quotation Declined</h3>
        <p className="text-sm text-red-500 mt-1">
          We appreciate your feedback. Feel free to reach out if you&apos;d like to discuss revised terms.
        </p>
      </div>
    )
  }

  if (!canRespond) return null

  async function handleResponse(response: "ACCEPTED" | "REJECTED") {
    setIsLoading(true)
    setError(null)
    startTransition(async () => {
      const result = await respondToQuotation(token, response, response === "REJECTED" ? reason : undefined)
      setIsLoading(false)
      if (result.error) {
        setError(result.error)
      } else {
        setDone(response)
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-bold text-slate-800 text-base mb-1">Your Response</h3>
      <p className="text-sm text-slate-500 mb-5">
        Please review the quotation above and indicate whether you&apos;d like to proceed.
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      {!showRejectForm ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => handleResponse("ACCEPTED")}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-60"
            style={{ background: "#16a34a" }}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
            Accept Quotation
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-60"
          >
            <XCircle className="size-4" />
            Decline
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MessageSquare className="size-4" />
            <span>Please let us know why you&apos;re declining (optional)</span>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Budget constraints, found another provider, need more time..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleResponse("REJECTED")}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Confirm Decline
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
