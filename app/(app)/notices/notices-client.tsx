"use client"

/**
 * Tax notice & litigation register — list with deadline urgency, filters,
 * and a create/edit dialog. Reply/hearing alerts ride the daily cron.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileWarning, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import {
  createNotice,
  updateNotice,
  deleteNotice,
  listNotices,
  getNoticeFormOptions,
  type NoticeInput,
} from "@/app/actions/notices"
import { NOTICE_STATUSES } from "@/app/actions/notice-statuses"
import { useAuth } from "@/components/auth/auth-provider"
import { formatINRCompact } from "@/lib/india/format"
import { cn } from "@/lib/utils"

type NoticeRow = {
  id: string
  noticeType: string
  section: string | null
  authority: string | null
  referenceNo: string | null
  noticeDate: string | Date | null
  receivedDate: string | Date | null
  replyDueDate: string | Date | null
  hearingDate: string | Date | null
  status: string
  demandAmount: unknown
  description: string | null
  notes: string | null
  assignedEmployeeId: string | null
  clientId: string
  client: { id: string; name: string }
  assignedEmployee: { id: string; name: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  REPLY_DRAFTED: "Reply drafted",
  REPLIED: "Replied",
  HEARING: "Hearing",
  CLOSED_FAVOURABLE: "Closed — favourable",
  CLOSED_UNFAVOURABLE: "Closed — unfavourable",
  CLOSED_PARTIAL: "Closed — partial",
}

const STATUS_TONES: Record<string, string> = {
  OPEN: "border-red-500/30 bg-red-500/10 text-red-400",
  REPLY_DRAFTED: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  REPLIED: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  HEARING: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  CLOSED_FAVOURABLE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  CLOSED_UNFAVOURABLE: "border-white/10 bg-white/[0.04] text-muted-foreground",
  CLOSED_PARTIAL: "border-white/10 bg-white/[0.04] text-muted-foreground",
}

const isClosed = (s: string) => s.startsWith("CLOSED")

function DueBadge({ date }: { date: string | Date | null }) {
  if (!date) return <span className="text-xs text-muted-foreground">—</span>
  const due = new Date(date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - today.getTime()) / 86_400_000)
  const label = due.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
  const tone =
    days < 0
      ? "border-red-500/40 bg-red-500/15 text-red-400"
      : days <= 3
        ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
        : "border-white/10 bg-white/[0.04] text-muted-foreground"
  const suffix = days < 0 ? ` · ${-days}d overdue` : days === 0 ? " · today" : days <= 7 ? ` · ${days}d` : ""
  return <Badge className={cn("font-mono text-[11px]", tone)}>{label}{suffix}</Badge>
}

const EMPTY_FORM: NoticeInput = {
  clientId: "",
  noticeType: "",
  section: "",
  authority: "",
  referenceNo: "",
  noticeDate: "",
  receivedDate: "",
  replyDueDate: "",
  hearingDate: "",
  status: "OPEN",
  demandAmount: "",
  description: "",
  notes: "",
  assignedEmployeeId: "",
}

const toDateInput = (v: string | Date | null | undefined) =>
  v ? new Date(v).toISOString().slice(0, 10) : ""

export function NoticesClient() {
  const { role } = useAuth()
  const canDelete = role === "PARTNER" || role === "MANAGER"
  const [notices, setNotices] = useState<NoticeRow[]>([])
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([])
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([])
  const [statusFilter, setStatusFilter] = useState("OPEN_ALL")
  const [clientFilter, setClientFilter] = useState("")
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<NoticeInput>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const rows = await listNotices({
      status: statusFilter || undefined,
      clientId: clientFilter || undefined,
    })
    setNotices(rows as unknown as NoticeRow[])
    setLoading(false)
  }, [statusFilter, clientFilter])

  useEffect(() => {
    void (async () => {
      const opts = await getNoticeFormOptions()
      setClients(opts.clients)
      setEmployees(opts.employees)
    })()
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const open = notices.filter((n) => !isClosed(n.status))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const week = new Date(today.getTime() + 7 * 86_400_000)
    const dueThisWeek = open.filter(
      (n) => n.replyDueDate && new Date(n.replyDueDate) >= today && new Date(n.replyDueDate) < week
    ).length
    const overdue = open.filter((n) => n.replyDueDate && new Date(n.replyDueDate) < today).length
    const demand = open.reduce((sum, n) => sum + (Number(n.demandAmount) || 0), 0)
    return { open: open.length, dueThisWeek, overdue, demand }
  }, [notices])

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, clientId: clientFilter || clients[0]?.id || "" })
    setFieldErrors({})
    setDialogOpen(true)
  }

  function openEdit(n: NoticeRow) {
    setEditingId(n.id)
    setForm({
      clientId: n.clientId,
      noticeType: n.noticeType,
      section: n.section ?? "",
      authority: n.authority ?? "",
      referenceNo: n.referenceNo ?? "",
      noticeDate: toDateInput(n.noticeDate),
      receivedDate: toDateInput(n.receivedDate),
      replyDueDate: toDateInput(n.replyDueDate),
      hearingDate: toDateInput(n.hearingDate),
      status: n.status as NoticeInput["status"],
      demandAmount: n.demandAmount ? String(n.demandAmount) : "",
      description: n.description ?? "",
      notes: n.notes ?? "",
      assignedEmployeeId: n.assignedEmployeeId ?? "",
    })
    setFieldErrors({})
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setFieldErrors({})
    try {
      const res = editingId ? await updateNotice(editingId, form) : await createNotice(form)
      if (!res.success) {
        setFieldErrors(res.fieldErrors ?? {})
        toast.error(res.error ?? "Could not save.")
        return
      }
      toast.success(editingId ? "Notice updated." : "Notice recorded.")
      setDialogOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteNotice(id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Notice deleted.")
    await load()
  }

  const set = (patch: Partial<NoticeInput>) => setForm((f) => ({ ...f, ...patch }))
  const err = (k: string) => fieldErrors[k]?.[0]

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="surface-elevated rounded-xl border border-white/[0.06] p-4">
          <p className="text-xs text-muted-foreground">Open notices</p>
          <p className="mt-1 text-2xl font-semibold">{stats.open}</p>
        </div>
        <div className={cn("surface-elevated rounded-xl border p-4", stats.overdue > 0 ? "border-red-500/30" : "border-white/[0.06]")}>
          <p className="text-xs text-muted-foreground">Replies overdue</p>
          <p className={cn("mt-1 text-2xl font-semibold", stats.overdue > 0 && "text-red-400")}>{stats.overdue}</p>
        </div>
        <div className={cn("surface-elevated rounded-xl border p-4", stats.dueThisWeek > 0 ? "border-amber-500/30" : "border-white/[0.06]")}>
          <p className="text-xs text-muted-foreground">Replies due this week</p>
          <p className={cn("mt-1 text-2xl font-semibold", stats.dueThisWeek > 0 && "text-amber-400")}>{stats.dueThisWeek}</p>
        </div>
        <div className="surface-elevated rounded-xl border border-white/[0.06] p-4">
          <p className="text-xs text-muted-foreground">Demand at stake (open)</p>
          <p className="mt-1 text-2xl font-semibold">{formatINRCompact(stats.demand)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-premium h-9 rounded-xl bg-transparent px-3 text-sm"
        >
          <option value="OPEN_ALL">All open</option>
          <option value="">Everything</option>
          {NOTICE_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="input-premium h-9 rounded-xl bg-transparent px-3 text-sm"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        <Button size="sm" className="btn-glow h-9 gap-1.5 rounded-xl" onClick={openCreate}>
          <Plus className="size-3.5" /> Record notice
        </Button>
      </div>

      {/* Table */}
      <div className="surface-elevated overflow-x-auto rounded-2xl border border-white/[0.06]">
        {loading ? (
          <p className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : notices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <FileWarning className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No notices in this view</p>
            <p className="text-xs text-muted-foreground">Record a notice to start tracking deadlines and hearings.</p>
          </div>
        ) : (
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Notice</th>
                <th className="px-3 py-2.5 font-medium">Authority / ref</th>
                <th className="px-3 py-2.5 font-medium">Reply due</th>
                <th className="px-3 py-2.5 font-medium">Hearing</th>
                <th className="px-3 py-2.5 text-right font-medium">Demand</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Assigned</th>
                <th className="w-16 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                  <td className="max-w-44 truncate px-3 py-2.5 font-medium">{n.client.name}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{n.noticeType}</p>
                    {n.section && <p className="text-[10px] text-muted-foreground">u/s {n.section}</p>}
                  </td>
                  <td className="max-w-48 px-3 py-2.5">
                    <p className="truncate">{n.authority ?? "—"}</p>
                    {n.referenceNo && <p className="truncate font-mono text-[10px] text-muted-foreground">{n.referenceNo}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    {isClosed(n.status) ? <span className="text-muted-foreground">—</span> : <DueBadge date={n.replyDueDate} />}
                  </td>
                  <td className="px-3 py-2.5">
                    {isClosed(n.status) ? <span className="text-muted-foreground">—</span> : <DueBadge date={n.hearingDate} />}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {Number(n.demandAmount) > 0 ? formatINRCompact(Number(n.demandAmount)) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge className={cn("text-[10px]", STATUS_TONES[n.status] ?? STATUS_TONES.OPEN)}>
                      {STATUS_LABELS[n.status] ?? n.status}
                    </Badge>
                  </td>
                  <td className="max-w-32 truncate px-3 py-2.5">{n.assignedEmployee?.name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(n)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Edit notice"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(n.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Delete notice"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/[0.08] bg-popover/95 backdrop-blur-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit notice" : "Record a tax notice"}</DialogTitle>
            <DialogDescription>
              Reply and hearing deadlines trigger automatic alerts to the assigned team member (or all partners).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Client *</span>
              <select
                value={form.clientId}
                onChange={(e) => set({ clientId: e.target.value })}
                className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm"
              >
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {err("clientId") && <span className="text-xs text-destructive">{err("clientId")}</span>}
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Notice type *</span>
              <Input
                value={form.noticeType}
                onChange={(e) => set({ noticeType: e.target.value })}
                placeholder="GST DRC-01 / IT 143(2) / TDS 200A"
                className="input-premium h-9 rounded-xl"
              />
              {err("noticeType") && <span className="text-xs text-destructive">{err("noticeType")}</span>}
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Section</span>
              <Input value={form.section ?? ""} onChange={(e) => set({ section: e.target.value })} placeholder="73(1)" className="input-premium h-9 rounded-xl" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Reference / DIN no.</span>
              <Input value={form.referenceNo ?? ""} onChange={(e) => set({ referenceNo: e.target.value })} className="input-premium h-9 rounded-xl font-mono" />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-muted-foreground">Issuing authority</span>
              <Input value={form.authority ?? ""} onChange={(e) => set({ authority: e.target.value })} placeholder="ITO Ward 4(2), Pune" className="input-premium h-9 rounded-xl" />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Notice date</span>
              <Input type="date" value={form.noticeDate ?? ""} onChange={(e) => set({ noticeDate: e.target.value })} className="input-premium h-9 rounded-xl" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Received on</span>
              <Input type="date" value={form.receivedDate ?? ""} onChange={(e) => set({ receivedDate: e.target.value })} className="input-premium h-9 rounded-xl" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Reply due</span>
              <Input type="date" value={form.replyDueDate ?? ""} onChange={(e) => set({ replyDueDate: e.target.value })} className="input-premium h-9 rounded-xl" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Hearing date</span>
              <Input type="date" value={form.hearingDate ?? ""} onChange={(e) => set({ hearingDate: e.target.value })} className="input-premium h-9 rounded-xl" />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Status</span>
              <select
                value={form.status}
                onChange={(e) => set({ status: e.target.value as NoticeInput["status"] })}
                className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm"
              >
                {NOTICE_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Demand amount (₹)</span>
              <Input
                inputMode="numeric"
                value={form.demandAmount ?? ""}
                onChange={(e) => set({ demandAmount: e.target.value })}
                placeholder="0"
                className="input-premium h-9 rounded-xl text-right font-mono"
              />
              {err("demandAmount") && <span className="text-xs text-destructive">{err("demandAmount")}</span>}
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-muted-foreground">Assigned to</span>
              <select
                value={form.assignedEmployeeId ?? ""}
                onChange={(e) => set({ assignedEmployeeId: e.target.value })}
                className="input-premium h-9 w-full rounded-xl bg-transparent px-2 text-sm"
              >
                <option value="">Unassigned (alerts go to all partners)</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-muted-foreground">What the notice says</span>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Gist of the demand / query raised"
                className="input-premium min-h-16 rounded-xl"
              />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-xs text-muted-foreground">Working notes</span>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Reply filed on…, submissions, next steps"
                className="input-premium min-h-16 rounded-xl"
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" className="input-premium rounded-xl" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-glow rounded-xl" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Record notice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
