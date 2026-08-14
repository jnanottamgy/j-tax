"use client"

/**
 * "Bill this engagement every month without me asking."
 *
 * Everything needed to do it has been on the ClientService row since the fee
 * columns landed — the client, the service, the agreed fee, the cadence — and
 * nothing ever used it. A firm with sixty monthly GST clients raised sixty
 * invoices by hand, from memory, and found the missed ones in the receivables
 * report or not at all.
 *
 * Engagements that cannot bill say why, here, rather than being silently passed
 * over by a cron at four in the morning. "Why didn't my retainer bill this
 * month" is the question this feature will be asked most.
 */

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { CalendarClock, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { GlassCard } from "@/components/dashboard/glass-card"
import {
  getClientRetainers,
  setRetainerBilling,
  type RetainerRow,
} from "@/app/actions/retainers"
import { formatINR } from "@/lib/india/format"

const CADENCE_LABEL: Record<string, string> = {
  MONTHLY: "every month",
  QUARTERLY: "every quarter",
  ANNUAL: "every year",
  ONE_TIME: "one-off",
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null

export function RetainerBillingCard({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<RetainerRow[] | null>(null)
  const [startOn, setStartOn] = useState(() => new Date().toISOString().split("T")[0])
  const [pending, startTransition] = useTransition()

  const load = () => {
    getClientRetainers(clientId)
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => {
    let cancelled = false
    getClientRetainers(clientId)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setRows([]) })
    return () => { cancelled = true }
  }, [clientId])

  if (!rows || rows.length === 0) return null

  function toggle(row: RetainerRow, enabled: boolean) {
    startTransition(async () => {
      const result = await setRetainerBilling({
        clientId,
        serviceType: row.serviceType,
        enabled,
        startOn: enabled ? startOn : undefined,
      })
      if (!result.success) {
        toast.error(result.error ?? "Could not change the schedule.")
        return
      }
      toast.success(
        enabled
          ? `${row.label} will be invoiced ${CADENCE_LABEL[row.billingFrequency] ?? "on schedule"}.`
          : `${row.label} is back to manual invoicing.`
      )
      load()
    })
  }

  const anyEnabled = rows.some((r) => r.autoInvoice)

  return (
    <GlassCard hover={false} className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="size-4 text-primary" aria-hidden />
            Retainer billing
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Raises the invoice on schedule as a draft, so it exists without anyone
            remembering. A partner still issues it.
          </p>
        </div>
        {!anyEnabled && (
          <div className="shrink-0">
            <label htmlFor="retainer-start" className="text-[11px] text-muted-foreground">
              Bill from
            </label>
            <Input
              id="retainer-start"
              type="date"
              value={startOn}
              onChange={(e) => setStartOn(e.target.value)}
              className="input-premium mt-1 h-8 w-36 rounded-lg text-xs"
              disabled={pending}
            />
          </div>
        )}
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-white/[0.05]">
        {rows.map((row) => (
          <li key={row.serviceType} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.blocker ? (
                  <span className="text-amber-400">{row.blocker}</span>
                ) : row.autoInvoice ? (
                  <>
                    {formatINR(row.agreedFee ?? 0)} {CADENCE_LABEL[row.billingFrequency]}
                    {row.nextBillingDate && ` · next on ${fmtDate(row.nextBillingDate)}`}
                  </>
                ) : (
                  <>
                    {formatINR(row.agreedFee ?? 0)} agreed, {CADENCE_LABEL[row.billingFrequency]} —
                    invoiced by hand
                  </>
                )}
              </p>
            </div>
            <Switch
              checked={row.autoInvoice}
              disabled={pending || row.blocker !== null}
              onCheckedChange={(v) => toggle(row, v)}
              aria-label={`Automatic billing for ${row.label}`}
            />
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
