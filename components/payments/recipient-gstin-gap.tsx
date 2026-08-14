"use client"

/**
 * "This invoice is about to go out with no recipient GSTIN."
 *
 * A blank client GSTIN never stopped anything: the place of supply falls back
 * to the firm's own state, the CGST/SGST split computes, and the invoice issues
 * looking perfectly normal. The cost lands on the client — a tax invoice with
 * no recipient GSTIN cannot support their input-credit claim, so the GST they
 * paid becomes their expense. They find out at reconciliation, months later,
 * against an invoice that has already been reported.
 *
 * The warning appears at the only moment it is still free to fix, and both
 * answers are available right here. Recording "not registered" is a real
 * answer, not a dismissal: it is stored on the client, so the firm is never
 * asked about that client again.
 *
 * Renders nothing when the GSTIN is known, when the client is on record as
 * unregistered, or when no GST is being charged.
 */

import { useState, useTransition } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setClientGstRegistration } from "@/app/actions/clients"
import { invoiceGstinWarning } from "@/lib/clients/gst-registration"

type Props = {
  clientId: string
  clientName: string
  gstin: string | null | undefined
  gstRegistration: string | null | undefined
  /** GST being charged on this invoice, in rupees. */
  taxAmount: number
  /** Called with the new GSTIN (or null when marked unregistered). */
  onResolved: (gstin: string | null) => void
  disabled?: boolean
}

export function RecipientGstinGap({
  clientId,
  clientName,
  gstin,
  gstRegistration,
  taxAmount,
  onResolved,
  disabled,
}: Props) {
  const [entry, setEntry] = useState("")
  const [error, setError] = useState("")
  const [resolved, setResolved] = useState<"gstin" | "unregistered" | null>(null)
  const [pending, startTransition] = useTransition()

  const warning = invoiceGstinWarning({ gstin, gstRegistration, taxAmount })

  if (resolved) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
        <p className="text-xs text-muted-foreground">
          {resolved === "gstin"
            ? "GSTIN saved to the client record. It will appear on this invoice and every one after it."
            : `${clientName} is recorded as not registered under GST. This invoice is correctly B2C, and we won't ask again.`}
        </p>
      </div>
    )
  }

  if (!warning || !clientId) return null

  function save(input: { gstin: string } | { unregistered: true }) {
    setError("")
    startTransition(async () => {
      const result = await setClientGstRegistration(clientId, input)
      if (result.error) {
        setError(result.error)
        return
      }
      setResolved("unregistered" in input ? "unregistered" : "gstin")
      onResolved(result.gstin ?? null)
    })
  }

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{warning.headline}</p>
          <p className="mt-1 text-xs text-muted-foreground">{warning.consequence}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={entry}
              onChange={(e) => setEntry(e.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className="input-premium h-9 w-full max-w-[15rem] rounded-lg font-mono text-xs tracking-wide"
              disabled={disabled || pending}
              aria-label={`GSTIN for ${clientName}`}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || pending || entry.trim().length === 0}
              onClick={() => save({ gstin: entry })}
            >
              Save GSTIN
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={disabled || pending}
              onClick={() => save({ unregistered: true })}
            >
              Not GST registered
            </Button>
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}
