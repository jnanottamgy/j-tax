"use client"

/**
 * Recycle Bin — restore or permanently delete soft-deleted clients,
 * documents, and invoices. Partner/Manager only (enforced server-side too).
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, FileText, Receipt, RotateCcw, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { restoreItem, purgeItem, type TrashData, type TrashItemType } from "@/app/actions/trash"
import { formatINR } from "@/lib/india/format"
import { cn } from "@/lib/utils"

type Section = "client" | "document" | "invoice"

function fmtWhen(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function TrashClient({ data, canPurge = false }: { data: TrashData; canPurge?: boolean }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [purge, setPurge] = useState<null | { type: TrashItemType; id: string; label: string }>(null)

  const total = data.clients.length + data.documents.length + data.invoices.length

  async function restore(type: TrashItemType, id: string) {
    setBusyId(id)
    try {
      const res = await restoreItem(type, id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Restored.")
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function doPurge() {
    if (!purge) return
    setBusyId(purge.id)
    try {
      const res = await purgeItem(purge.type, purge.id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Permanently deleted.")
      setPurge(null)
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  if (total === 0) {
    return (
      <div className="surface-elevated flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] px-4 py-16 text-center">
        <Trash2 className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">The recycle bin is empty</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Deleted clients, documents, and invoices appear here so you can restore them if a deletion was a mistake.
        </p>
      </div>
    )
  }

  const rows: Array<{
    section: Section
    id: string
    icon: typeof Building2
    primary: string
    secondary: string
    deletedAt: Date
    label: string
  }> = [
    ...data.clients.map((c) => ({
      section: "client" as const,
      id: c.id,
      icon: Building2,
      primary: c.name,
      secondary: c.clientCode,
      deletedAt: c.deletedAt,
      label: c.name,
    })),
    ...data.documents.map((d) => ({
      section: "document" as const,
      id: d.id,
      icon: FileText,
      primary: d.title,
      secondary: `${d.fileName} · ${d.clientName}`,
      deletedAt: d.deletedAt,
      label: d.title,
    })),
    ...data.invoices.map((i) => ({
      section: "invoice" as const,
      id: i.id,
      icon: Receipt,
      primary: i.invoiceNumber,
      secondary: `${i.clientName} · ${formatINR(i.amount)}`,
      deletedAt: i.deletedAt,
      label: i.invoiceNumber,
    })),
  ]

  const SECTION_META: Record<Section, { label: string; count: number }> = {
    client: { label: "Clients", count: data.clients.length },
    document: { label: "Documents", count: data.documents.length },
    invoice: { label: "Invoices", count: data.invoices.length },
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        {(Object.keys(SECTION_META) as Section[]).map((s) => (
          <div key={s} className="surface-elevated rounded-xl border border-white/[0.06] px-4 py-3">
            <p className="text-xs text-muted-foreground">{SECTION_META[s].label}</p>
            <p className="text-2xl font-semibold">{SECTION_META[s].count}</p>
          </div>
        ))}
      </div>

      <div className="surface-elevated divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06]">
        {rows.map((r) => (
          <div key={`${r.section}-${r.id}`} className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
              <r.icon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.primary}</p>
              <p className="truncate text-xs text-muted-foreground">{r.secondary}</p>
            </div>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">deleted {fmtWhen(r.deletedAt)}</span>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="input-premium h-8 gap-1.5 rounded-lg text-xs"
                disabled={busyId === r.id}
                onClick={() => void restore(r.section, r.id)}
              >
                <Undo2 className="size-3.5" /> Restore
              </Button>
              {canPurge && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn("size-8 text-muted-foreground hover:text-destructive")}
                  aria-label="Delete permanently"
                  disabled={busyId === r.id}
                  onClick={() => setPurge({ type: r.section, id: r.id, label: r.label })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RotateCcw className="size-3" /> Restoring returns an item to its original list. Permanent deletion cannot be undone.
      </p>

      <ConfirmDialog
        open={purge !== null}
        onOpenChange={(o) => !o && setPurge(null)}
        title="Delete permanently?"
        description={
          purge
            ? `"${purge.label}" will be permanently deleted. This cannot be undone.${purge.type === "client" ? " All its tasks, invoices, and documents go with it." : ""}`
            : ""
        }
        confirmLabel="Delete forever"
        destructive
        onConfirm={() => void doPurge()}
      />
    </div>
  )
}
