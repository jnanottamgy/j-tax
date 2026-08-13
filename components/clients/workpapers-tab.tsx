"use client"

/**
 * This client's workpapers, on this client's screen.
 *
 * GST reconciliations, ITR computations, financial statements and tax notices
 * are all per-client work products, but each was reachable only from a
 * firm-level page you opened cold and then searched in. Client 360 is the
 * screen someone already has open when they think "I need to do Patel's ITR",
 * so the work belongs here — and the New buttons open each tool already scoped
 * to this client instead of making them pick from a list of two hundred.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  AlertTriangle,
  BookOpenCheck,
  Calculator,
  FileWarning,
  GitCompareArrows,
  Loader2,
  Plus,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/dashboard/glass-card"
import {
  getClientWorkpapers,
  type ClientWorkpapers,
  type WorkpaperItem,
} from "@/app/actions/workpapers"
import { cn } from "@/lib/utils"

const KIND_META: Record<
  WorkpaperItem["kind"],
  { icon: React.ElementType; label: string; tone: string }
> = {
  GST_RECON: {
    icon: GitCompareArrows,
    label: "GST recon",
    tone: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  },
  ITR: {
    icon: Calculator,
    label: "ITR",
    tone: "border-purple-500/25 bg-purple-500/10 text-purple-300",
  },
  FINANCIAL_STATEMENT: {
    icon: BookOpenCheck,
    label: "Accounts",
    tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  TAX_NOTICE: {
    icon: FileWarning,
    label: "Notice",
    tone: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
}

export function WorkpapersTab({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [data, setData] = useState<ClientWorkpapers | null>(null)

  useEffect(() => {
    let cancelled = false
    getClientWorkpapers(clientId)
      .then((r) => { if (!cancelled) setData(r) })
      .catch(() => {
        if (!cancelled) {
          setData({
            items: [],
            counts: {
              gstRecon: 0,
              itr: 0,
              financialStatements: 0,
              taxNotices: 0,
              openNotices: 0,
            },
          })
        }
      })
    return () => { cancelled = true }
  }, [clientId])

  // Every tool opens pre-scoped to this client.
  const tools = [
    {
      label: "GST reconciliation",
      hint: "Match GSTR-2B against the purchase register",
      icon: GitCompareArrows,
      href: `/gst-reconciliation?clientId=${clientId}`,
      count: data?.counts.gstRecon ?? 0,
    },
    {
      label: "ITR computation",
      hint: "Old vs new regime, side by side",
      icon: Calculator,
      href: `/itr-computation?clientId=${clientId}`,
      count: data?.counts.itr ?? 0,
    },
    {
      label: "Financial statements",
      hint: "Trial balance → P&L and Balance Sheet",
      icon: BookOpenCheck,
      href: `/financial-statements?clientId=${clientId}`,
      count: data?.counts.financialStatements ?? 0,
    },
    {
      label: "Tax notice",
      hint: "Record a notice and its reply deadline",
      icon: FileWarning,
      href: `/notices?clientId=${clientId}&new=1`,
      count: data?.counts.taxNotices ?? 0,
    },
  ]

  const urgent = data?.items.filter((i) => i.urgent) ?? []

  return (
    <div className="space-y-6">
      {urgent.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-5 py-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-medium">
              {urgent.length} notice{urgent.length === 1 ? " is" : "s are"} past their reply date
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {urgent.map((u) => u.title).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Start something */}
      <GlassCard hover={false} className="p-6">
        <h3 className="text-lg font-semibold">Start a workpaper</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Each opens already set to this client.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tools.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => router.push(t.href)}
                className="group flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{t.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {t.count > 0 ? t.count : <Plus className="size-3.5" />}
                </span>
              </button>
            )
          })}
        </div>
      </GlassCard>

      {/* What already exists */}
      <GlassCard hover={false} className="p-6">
        <h3 className="text-lg font-semibold">On file</h3>
        {data === null ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : data.items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-sm text-muted-foreground">
            No workpapers yet for this client.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {data.items.map((item) => {
              const meta = KIND_META[item.kind]
              const Icon = meta.icon
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/5",
                    item.urgent
                      ? "border-red-500/25 bg-red-500/[0.05]"
                      : "border-white/[0.08] bg-white/[0.02]"
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 text-sm font-medium">{item.title}</span>
                  <Badge variant="outline" className={cn("text-[10px]", meta.tone)}>
                    {meta.label}
                  </Badge>
                  {item.status && (
                    <Badge variant="outline" className="text-[10px]">
                      {item.status}
                    </Badge>
                  )}
                  <span className="w-full text-xs text-muted-foreground sm:w-auto">
                    {item.subtitle}
                  </span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {format(new Date(item.at), "d MMM yyyy")}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
