"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatINR } from "@/lib/india/format"
import {
  getClientAmountBreakdown,
  type AmountMetric,
  type ClientAmountRow,
} from "@/app/actions/dashboard-drilldown"

const TITLES: Record<AmountMetric, string> = {
  revenue: "Total Revenue by client",
  outstanding: "Outstanding by client",
  overdue: "Overdue amount by client",
  collected: "Collected by client",
}

export function AmountBreakdownDialog({
  metric,
  open,
  onOpenChange,
}: {
  metric: AmountMetric | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ClientAmountRow[]>([])

  useEffect(() => {
    if (!open || !metric) return
    let cancelled = false
    setLoading(true)
    setRows([])
    void getClientAmountBreakdown(metric)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, metric])

  const total = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{metric ? TITLES[metric] : ""}</DialogTitle>
          <DialogDescription>
            Which clients make up this amount. Click a client to open their profile.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No amounts to break down.
          </p>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto">
            <div className="mb-2 flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs text-muted-foreground">
              <span>{rows.length} client{rows.length === 1 ? "" : "s"}</span>
              <span className="font-mono">{formatINR(total)}</span>
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {rows.map((r) => (
                <li key={r.clientId}>
                  <Link
                    href={`/clients/${r.clientId}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                  >
                    <span className="min-w-0 truncate">
                      {r.name}
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{r.code}</span>
                    </span>
                    <span className="shrink-0 font-mono tabular-nums">{formatINR(r.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
