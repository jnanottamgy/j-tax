"use client"

import { Printer } from "lucide-react"

/** Light-themed print trigger for the public quotation portal. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 print:hidden"
    >
      <Printer className="size-4" aria-hidden />
      Print
    </button>
  )
}
