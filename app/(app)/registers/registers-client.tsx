"use client"

/**
 * Statutory registers workbench (Partner/Manager) — firm-wide view of
 * statutory registrations, DSC tokens, and UDINs, with expiry alerts.
 * All mutations go through app/actions/registers.ts.
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Award, FileSignature, Loader2, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  upsertRegistration,
  deleteRegistration,
  upsertDscRecord,
  deleteDscRecord,
  createUdinRecord,
  deleteUdinRecord,
  type FirmRegistrationRow,
  type FirmDscRow,
  type FirmUdinRow,
  type ExpiringRegistration,
  type ExpiringDsc,
} from "@/app/actions/registers"
import type { ClientOption } from "@/app/actions/job-templates"
import {
  REGISTRATION_TYPES,
  REGISTRATION_TYPE_LABELS,
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_LABELS,
  DSC_CLASSES,
  DSC_CLASS_LABELS,
  DSC_STATUSES,
  DSC_STATUS_LABELS,
} from "@/lib/registers/constants"
import { cn } from "@/lib/utils"

type Tab = "registrations" | "dscs" | "udins"

function fmtDate(d: Date | string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function daysUntil(d: Date | string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  return Math.floor(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() - today.getTime()) / 86_400_000
  )
}

function ExpiryBadge({ date }: { date: Date | string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const days = daysUntil(date)
  const tone =
    days < 0
      ? "border-red-500/40 bg-red-500/15 text-red-400"
      : days <= 30
        ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
        : "border-white/10 bg-white/[0.04] text-muted-foreground"
  const suffix = days < 0 ? ` · ${-days}d ago` : days === 0 ? " · today" : days <= 60 ? ` · ${days}d` : ""
  return <Badge className={cn("font-mono text-[11px]", tone)}>{fmtDate(date)}{suffix}</Badge>
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  EXPIRED: "border-red-500/30 bg-red-500/10 text-red-400",
  REVOKED: "border-red-500/30 bg-red-500/10 text-red-400",
  SURRENDERED: "border-white/10 bg-white/[0.04] text-muted-foreground",
  CANCELLED: "border-white/10 bg-white/[0.04] text-muted-foreground",
}

export function RegistersClient({
  registrations,
  dscs,
  udins,
  expiring,
  clients,
}: {
  registrations: FirmRegistrationRow[]
  dscs: FirmDscRow[]
  udins: FirmUdinRow[]
  expiring: { registrations: ExpiringRegistration[]; dscs: ExpiringDsc[] }
  clients: ClientOption[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("registrations")
  const [dialog, setDialog] = useState<null | "registration" | "dsc" | "udin">(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<null | { kind: Tab; id: string; label: string }>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  const expiringCount = expiring.registrations.length + expiring.dscs.length

  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  function openDialog(kind: "registration" | "dsc" | "udin") {
    setForm({ clientId: clients[0]?.id ?? "" })
    setDialog(kind)
  }

  async function submit() {
    setSaving(true)
    try {
      let res: { success?: boolean; error?: string; fieldErrors?: Record<string, string[]> }
      if (dialog === "registration") {
        res = await upsertRegistration({
          clientId: form.clientId,
          registrationType: (form.registrationType as (typeof REGISTRATION_TYPES)[number]) ?? "GST",
          registrationNumber: form.registrationNumber ?? "",
          jurisdiction: form.jurisdiction,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate,
          status: (form.status as (typeof REGISTRATION_STATUSES)[number]) ?? "ACTIVE",
          notes: form.notes,
        })
      } else if (dialog === "dsc") {
        res = await upsertDscRecord({
          clientId: form.clientId,
          holderName: form.holderName ?? "",
          dscClass: (form.dscClass as (typeof DSC_CLASSES)[number]) ?? "CLASS_3",
          serialNumber: form.serialNumber,
          issuedBy: form.issuedBy,
          issueDate: form.issueDate,
          expiryDate: form.expiryDate ?? "",
          custody: form.custody,
          status: (form.status as (typeof DSC_STATUSES)[number]) ?? "ACTIVE",
          notes: form.notes,
        })
      } else {
        res = await createUdinRecord({
          clientId: form.clientId || undefined,
          udin: form.udin ?? "",
          documentType: form.documentType ?? "",
          documentDate: form.documentDate ?? "",
          generatedBy: form.generatedBy,
          remarks: form.remarks,
        })
      }
      if (res.error || res.fieldErrors) {
        const firstField = res.fieldErrors ? Object.values(res.fieldErrors)[0]?.[0] : undefined
        toast.error(res.error ?? firstField ?? "Could not save. Check the fields.")
        return
      }
      toast.success("Saved.")
      setDialog(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    if (!confirm) return
    const { kind, id } = confirm
    const res =
      kind === "registrations"
        ? await deleteRegistration(id)
        : kind === "dscs"
          ? await deleteDscRecord(id)
          : await deleteUdinRecord(id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Deleted.")
    setConfirm(null)
    router.refresh()
  }

  const tabs = useMemo(
    () =>
      [
        { key: "registrations" as const, label: "Registrations", count: registrations.length, icon: ShieldCheck },
        { key: "dscs" as const, label: "Digital Signatures", count: dscs.length, icon: FileSignature },
        { key: "udins" as const, label: "UDINs", count: udins.length, icon: Award },
      ],
    [registrations.length, dscs.length, udins.length]
  )

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Registrations" value={registrations.length} />
        <SummaryCard label="Digital signatures" value={dscs.length} />
        <SummaryCard label="UDINs issued" value={udins.length} />
        <SummaryCard label="Expiring ≤ 60 days" value={expiringCount} tone={expiringCount > 0 ? "amber" : undefined} />
      </div>

      {/* Expiring soon */}
      {expiringCount > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-400">
            <TriangleAlert className="size-4" /> Expiring within 60 days
          </div>
          <div className="space-y-1.5">
            {expiring.registrations.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate">
                  <span className="font-medium">{r.clientName}</span> — {REGISTRATION_TYPE_LABELS[r.registrationType as keyof typeof REGISTRATION_TYPE_LABELS] ?? r.registrationType} ({r.registrationNumber})
                </span>
                <ExpiryBadge date={r.expiryDate} />
              </div>
            ))}
            {expiring.dscs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate">
                  <span className="font-medium">{d.clientName}</span> — DSC of {d.holderName} ({DSC_CLASS_LABELS[d.dscClass as keyof typeof DSC_CLASS_LABELS] ?? d.dscClass})
                </span>
                <ExpiryBadge date={d.expiryDate} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-white/[0.08] text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-3.5" /> {t.label}
            <span className="text-xs text-muted-foreground">({t.count})</span>
          </button>
        ))}
        <div className="flex-1" />
        <Button
          size="sm"
          className="btn-glow h-9 gap-1.5 rounded-xl"
          onClick={() => openDialog(tab === "registrations" ? "registration" : tab === "dscs" ? "dsc" : "udin")}
        >
          <Plus className="size-3.5" /> Add {tab === "registrations" ? "registration" : tab === "dscs" ? "DSC" : "UDIN"}
        </Button>
      </div>

      {/* Tables */}
      <div className="surface-elevated overflow-x-auto rounded-2xl border border-white/[0.06]">
        {tab === "registrations" && (
          <RegTable
            rows={registrations}
            onDelete={(r) => setConfirm({ kind: "registrations", id: r.id, label: `${r.registrationType} ${r.registrationNumber}` })}
          />
        )}
        {tab === "dscs" && (
          <DscTable rows={dscs} onDelete={(d) => setConfirm({ kind: "dscs", id: d.id, label: `DSC of ${d.holderName}` })} />
        )}
        {tab === "udins" && (
          <UdinTable rows={udins} onDelete={(u) => setConfirm({ kind: "udins", id: u.id, label: `UDIN ${u.udin}` })} />
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/[0.08] bg-popover/95 backdrop-blur-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Add {dialog === "registration" ? "statutory registration" : dialog === "dsc" ? "digital signature" : "UDIN"}
            </DialogTitle>
            <DialogDescription>Recorded firm-wide and surfaced in expiry alerts.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Client (optional only for UDIN) */}
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-muted-foreground">Client{dialog === "udin" ? " (optional)" : " *"}</span>
              <select
                value={form.clientId ?? ""}
                onChange={(e) => setF("clientId", e.target.value)}
                className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm"
              >
                {dialog === "udin" && <option value="">— firm-level —</option>}
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            {dialog === "registration" && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <select value={form.registrationType ?? "GST"} onChange={(e) => setF("registrationType", e.target.value)} className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm">
                    {REGISTRATION_TYPES.map((t) => <option key={t} value={t}>{REGISTRATION_TYPE_LABELS[t]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Registration number *</span>
                  <Input value={form.registrationNumber ?? ""} onChange={(e) => setF("registrationNumber", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Jurisdiction</span>
                  <Input value={form.jurisdiction ?? ""} onChange={(e) => setF("jurisdiction", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <select value={form.status ?? "ACTIVE"} onChange={(e) => setF("status", e.target.value)} className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm">
                    {REGISTRATION_STATUSES.map((s) => <option key={s} value={s}>{REGISTRATION_STATUS_LABELS[s]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Issue date</span>
                  <Input type="date" value={form.issueDate ?? ""} onChange={(e) => setF("issueDate", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Expiry date</span>
                  <Input type="date" value={form.expiryDate ?? ""} onChange={(e) => setF("expiryDate", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Notes</span>
                  <Textarea value={form.notes ?? ""} onChange={(e) => setF("notes", e.target.value)} className="input-premium min-h-16 rounded-xl" />
                </label>
              </>
            )}

            {dialog === "dsc" && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Holder name *</span>
                  <Input value={form.holderName ?? ""} onChange={(e) => setF("holderName", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Class</span>
                  <select value={form.dscClass ?? "CLASS_3"} onChange={(e) => setF("dscClass", e.target.value)} className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm">
                    {DSC_CLASSES.map((c) => <option key={c} value={c}>{DSC_CLASS_LABELS[c]}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Serial number</span>
                  <Input value={form.serialNumber ?? ""} onChange={(e) => setF("serialNumber", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Issued by (CA)</span>
                  <Input value={form.issuedBy ?? ""} onChange={(e) => setF("issuedBy", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Issue date</span>
                  <Input type="date" value={form.issueDate ?? ""} onChange={(e) => setF("issueDate", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Expiry date *</span>
                  <Input type="date" value={form.expiryDate ?? ""} onChange={(e) => setF("expiryDate", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Custody (who holds the token)</span>
                  <Input value={form.custody ?? ""} onChange={(e) => setF("custody", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <select value={form.status ?? "ACTIVE"} onChange={(e) => setF("status", e.target.value)} className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm">
                    {DSC_STATUSES.map((s) => <option key={s} value={s}>{DSC_STATUS_LABELS[s]}</option>)}
                  </select>
                </label>
              </>
            )}

            {dialog === "udin" && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">UDIN *</span>
                  <Input value={form.udin ?? ""} onChange={(e) => setF("udin", e.target.value)} placeholder="15–18 chars" className="input-premium h-9 rounded-xl font-mono" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs text-muted-foreground">Document date *</span>
                  <Input type="date" value={form.documentDate ?? ""} onChange={(e) => setF("documentDate", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Document type *</span>
                  <Input value={form.documentType ?? ""} onChange={(e) => setF("documentType", e.target.value)} placeholder="Tax Audit Report / Certificate / GST Audit…" className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Generated by (membership no.)</span>
                  <Input value={form.generatedBy ?? ""} onChange={(e) => setF("generatedBy", e.target.value)} className="input-premium h-9 rounded-xl" />
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                  <span className="text-xs text-muted-foreground">Remarks</span>
                  <Textarea value={form.remarks ?? ""} onChange={(e) => setF("remarks", e.target.value)} className="input-premium min-h-16 rounded-xl" />
                </label>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="input-premium rounded-xl" onClick={() => setDialog(null)}>Cancel</Button>
            <Button className="btn-glow rounded-xl" disabled={saving} onClick={() => void submit()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this record?"
        description={confirm ? `"${confirm.label}" will be permanently removed from the register.` : ""}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void doDelete()}
      />
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return (
    <div className={cn("surface-elevated rounded-xl border p-4", tone === "amber" && value > 0 ? "border-amber-500/30" : "border-white/[0.06]")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold", tone === "amber" && value > 0 && "text-amber-400")}>{value}</p>
    </div>
  )
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted-foreground">{text}</td>
    </tr>
  )
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-muted-foreground transition-colors hover:text-destructive" aria-label="Delete">
      <Trash2 className="size-3.5" />
    </button>
  )
}

function RegTable({ rows, onDelete }: { rows: FirmRegistrationRow[]; onDelete: (r: FirmRegistrationRow) => void }) {
  return (
    <table className="w-full min-w-[820px] text-left text-xs">
      <thead>
        <tr className="border-b border-white/[0.06] text-muted-foreground">
          <th className="px-3 py-2.5 font-medium">Client</th>
          <th className="px-3 py-2.5 font-medium">Type</th>
          <th className="px-3 py-2.5 font-medium">Number</th>
          <th className="px-3 py-2.5 font-medium">Jurisdiction</th>
          <th className="px-3 py-2.5 font-medium">Expiry</th>
          <th className="px-3 py-2.5 font-medium">Status</th>
          <th className="w-10 px-3 py-2.5"></th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow cols={7} text="No registrations recorded yet." />
        ) : (
          rows.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
              <td className="max-w-40 truncate px-3 py-2.5 font-medium">{r.clientName}</td>
              <td className="px-3 py-2.5">{REGISTRATION_TYPE_LABELS[r.registrationType as keyof typeof REGISTRATION_TYPE_LABELS] ?? r.registrationType}</td>
              <td className="px-3 py-2.5 font-mono">{r.registrationNumber}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.jurisdiction ?? "—"}</td>
              <td className="px-3 py-2.5"><ExpiryBadge date={r.expiryDate} /></td>
              <td className="px-3 py-2.5"><Badge className={cn("text-[10px]", STATUS_TONE[r.status])}>{REGISTRATION_STATUS_LABELS[r.status as keyof typeof REGISTRATION_STATUS_LABELS] ?? r.status}</Badge></td>
              <td className="px-3 py-2.5"><DeleteBtn onClick={() => onDelete(r)} /></td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

function DscTable({ rows, onDelete }: { rows: FirmDscRow[]; onDelete: (d: FirmDscRow) => void }) {
  return (
    <table className="w-full min-w-[820px] text-left text-xs">
      <thead>
        <tr className="border-b border-white/[0.06] text-muted-foreground">
          <th className="px-3 py-2.5 font-medium">Client</th>
          <th className="px-3 py-2.5 font-medium">Holder</th>
          <th className="px-3 py-2.5 font-medium">Class</th>
          <th className="px-3 py-2.5 font-medium">Custody</th>
          <th className="px-3 py-2.5 font-medium">Expiry</th>
          <th className="px-3 py-2.5 font-medium">Status</th>
          <th className="w-10 px-3 py-2.5"></th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow cols={7} text="No digital signatures recorded yet." />
        ) : (
          rows.map((d) => (
            <tr key={d.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
              <td className="max-w-40 truncate px-3 py-2.5 font-medium">{d.clientName}</td>
              <td className="px-3 py-2.5">{d.holderName}</td>
              <td className="px-3 py-2.5">{DSC_CLASS_LABELS[d.dscClass as keyof typeof DSC_CLASS_LABELS] ?? d.dscClass}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{d.custody ?? "—"}</td>
              <td className="px-3 py-2.5"><ExpiryBadge date={d.expiryDate} /></td>
              <td className="px-3 py-2.5"><Badge className={cn("text-[10px]", STATUS_TONE[d.status])}>{DSC_STATUS_LABELS[d.status as keyof typeof DSC_STATUS_LABELS] ?? d.status}</Badge></td>
              <td className="px-3 py-2.5"><DeleteBtn onClick={() => onDelete(d)} /></td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

function UdinTable({ rows, onDelete }: { rows: FirmUdinRow[]; onDelete: (u: FirmUdinRow) => void }) {
  return (
    <table className="w-full min-w-[820px] text-left text-xs">
      <thead>
        <tr className="border-b border-white/[0.06] text-muted-foreground">
          <th className="px-3 py-2.5 font-medium">UDIN</th>
          <th className="px-3 py-2.5 font-medium">Document type</th>
          <th className="px-3 py-2.5 font-medium">Client</th>
          <th className="px-3 py-2.5 font-medium">Date</th>
          <th className="px-3 py-2.5 font-medium">Generated by</th>
          <th className="w-10 px-3 py-2.5"></th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow cols={6} text="No UDINs recorded yet." />
        ) : (
          rows.map((u) => (
            <tr key={u.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
              <td className="px-3 py-2.5 font-mono">{u.udin}</td>
              <td className="px-3 py-2.5">{u.documentType}</td>
              <td className="max-w-40 truncate px-3 py-2.5 text-muted-foreground">{u.clientName ?? "Firm-level"}</td>
              <td className="px-3 py-2.5">{fmtDate(u.documentDate)}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{u.generatedBy ?? "—"}</td>
              <td className="px-3 py-2.5"><DeleteBtn onClick={() => onDelete(u)} /></td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
