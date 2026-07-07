import { format } from "date-fns"

import { amountInWords, DEFAULT_QUOTATION_TERMS } from "@/lib/quotations/terms"
import { formatINR } from "@/lib/india/format"

/**
 * The client-ready quotation document — a single source of truth for how a
 * quotation looks, shared by the builder's live preview, the internal detail
 * page, and the public portal. Always renders as a light "sheet of paper"
 * regardless of app theme, and is print-friendly.
 */

export type QuotationDocumentFirm = {
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  gstin?: string | null
  website?: string | null
}

export type QuotationDocumentItem = {
  id: string
  description: string
  serviceType?: string | null
  /** Professional fee for the engagement (ex-GST) */
  fee: number
  taxRate: number
  taxAmount: number
  total: number
}

export type QuotationDocumentData = {
  number: string
  issuedAt: Date | string
  validUntil: Date | string
  clientName: string
  clientCompany?: string | null
  clientEmail?: string | null
  clientPhone?: string | null
  items: QuotationDocumentItem[]
  subtotal: number
  taxAmount: number
  total: number
  notes?: string | null
  terms?: string | null
  /** Stamp the acceptance area when the client has already responded */
  acceptance?: {
    status: "ACCEPTED" | "REJECTED"
    respondedAt?: Date | string | null
  } | null
}

const BRAND = "#1e3a8a"

const inr = (n: number) => formatINR(n, { paise: true })

function asDate(d: Date | string) {
  return format(new Date(d), "dd MMM yyyy")
}

export function QuotationDocument({
  firm,
  quotation,
}: {
  firm: QuotationDocumentFirm
  quotation: QuotationDocumentData
}) {
  const firmContact = [firm.phone, firm.email, firm.website]
    .filter(Boolean)
    .join("  ·  ")

  return (
    <div
      className="mx-auto w-full max-w-[820px] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
      // Keep the sheet light even inside the dark app — it previews the
      // actual document the client receives.
      style={{ colorScheme: "light" }}
    >
      {/* Brand accent */}
      <div className="h-1.5 w-full print:h-1" style={{ background: BRAND }} aria-hidden />

      {/* ── Letterhead ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-8 pt-8 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ color: BRAND }}
          >
            {firm.name}
          </p>
          {firm.address && (
            <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-slate-500">
              {firm.address}
            </p>
          )}
          {firmContact && (
            <p className="mt-1 text-xs text-slate-500">{firmContact}</p>
          )}
          {firm.gstin && (
            <p className="mt-1 text-xs font-medium text-slate-500">
              GSTIN: {firm.gstin}
            </p>
          )}
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-3xl font-bold uppercase tracking-widest text-slate-200 print:text-slate-300">
            Quotation
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-700">
            #{quotation.number}
          </p>
        </div>
      </div>

      {/* ── Meta strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 border-y border-slate-200 bg-slate-50/70">
        {[
          { label: "Date of Issue", value: asDate(quotation.issuedAt) },
          { label: "Valid Until", value: asDate(quotation.validUntil) },
          {
            label: "Prepared By",
            value: firm.name,
          },
        ].map((m) => (
          <div key={m.label} className="border-r border-slate-200 px-6 py-3 last:border-r-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {m.label}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{m.value}</p>
          </div>
        ))}
      </div>

      {/* ── Prepared for ───────────────────────────────────────────────── */}
      <div className="px-8 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Prepared For
        </p>
        <p className="mt-1 text-base font-semibold text-slate-900">
          {quotation.clientCompany || quotation.clientName}
        </p>
        <p className="text-sm text-slate-500">
          {[
            quotation.clientCompany ? quotation.clientName : null,
            quotation.clientEmail,
            quotation.clientPhone,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </p>
      </div>

      {/* ── Professional services table ────────────────────────────────── */}
      <div className="overflow-x-auto px-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: BRAND }}>
              <th className="w-8 rounded-tl-md px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white">
                Professional Services
              </th>
              <th className="w-32 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-white">
                Fee (₹)
              </th>
              <th className="w-16 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-white">
                GST
              </th>
              <th className="w-32 rounded-tr-md px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-white">
                Amount (₹)
              </th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item, i) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-3 py-3 align-top text-slate-500">{i + 1}</td>
                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-slate-800">
                    {item.description || (
                      <span className="italic text-slate-300">Service description…</span>
                    )}
                  </p>
                  {item.serviceType && (
                    <p className="mt-0.5 text-xs text-slate-500">{item.serviceType}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-right align-top tabular-nums text-slate-600">
                  {inr(item.fee)}
                </td>
                <td className="px-3 py-3 text-right align-top tabular-nums text-xs text-slate-500">
                  {item.taxRate}%
                </td>
                <td className="px-3 py-3 text-right align-top font-semibold tabular-nums text-slate-800">
                  {inr(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totals ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end px-8 pt-4">
        <div className="w-full max-w-[300px] space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Professional Fees</span>
            <span className="tabular-nums">{inr(quotation.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>GST</span>
            <span className="tabular-nums">{inr(quotation.taxAmount)}</span>
          </div>
          <div
            className="flex items-center justify-between rounded-md px-3 py-2 text-base font-bold text-white"
            style={{ background: BRAND }}
          >
            <span>Total</span>
            <span className="tabular-nums">{inr(quotation.total)}</span>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      <p className="px-8 pt-3 text-right text-xs italic text-slate-500">
        {amountInWords(quotation.total)}
      </p>

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      {quotation.notes && (
        <div className="mx-8 mt-5 rounded-md border border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{quotation.notes}</p>
        </div>
      )}

      {/* ── Terms ──────────────────────────────────────────────────────── */}
      <div className="px-8 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Terms &amp; Conditions
        </p>
        <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-500">
          {quotation.terms || DEFAULT_QUOTATION_TERMS}
        </p>
      </div>

      {/* ── Signatures ─────────────────────────────────────────────────── */}
      <div className="mt-8 grid grid-cols-2 gap-10 px-8">
        <div className="pt-10">
          {quotation.acceptance?.status === "ACCEPTED" ? (
            <div className="mb-2 inline-flex rotate-[-3deg] rounded border-2 border-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-600">
              Accepted
              {quotation.acceptance.respondedAt
                ? ` · ${asDate(quotation.acceptance.respondedAt)}`
                : ""}
            </div>
          ) : quotation.acceptance?.status === "REJECTED" ? (
            <div className="mb-2 inline-flex rotate-[-3deg] rounded border-2 border-red-500 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-500">
              Declined
              {quotation.acceptance.respondedAt
                ? ` · ${asDate(quotation.acceptance.respondedAt)}`
                : ""}
            </div>
          ) : null}
          <div className="border-t border-slate-300 pt-1.5">
            <p className="text-xs font-medium text-slate-600">Client Acceptance</p>
            <p className="text-[10px] text-slate-500">Signature &amp; Date</p>
          </div>
        </div>
        <div className="pt-10 text-right">
          <p className="pb-8 text-xs font-semibold text-slate-700">For {firm.name}</p>
          <div className="border-t border-slate-300 pt-1.5">
            <p className="text-xs font-medium text-slate-600">Authorised Signatory</p>
            <p className="text-[10px] text-slate-500">Name, Signature &amp; Seal</p>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <p className="mt-8 border-t border-slate-100 px-8 py-4 text-center text-[10px] text-slate-500">
        This is a computer-generated quotation from {firm.name}
        {firm.email ? ` · Questions? ${firm.email}` : ""}
      </p>
    </div>
  )
}
