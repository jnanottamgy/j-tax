"use client"

/**
 * Engagement letters and filing history for one client.
 *
 * The two records a practice is expected to keep that had nowhere to live: the
 * written terms the work is done under, and what has actually been filed —
 * including the year of history that arrives with a client moving from another
 * accountant.
 */

import { useCallback, useEffect, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  AlertTriangle,
  FileCheck2,
  FileSignature,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GlassCard } from "@/components/dashboard/glass-card"
import {
  deleteEngagementLetter,
  deleteFilingRecord,
  getEngagementLetters,
  getFilingRecords,
  saveEngagementLetter,
  saveFilingRecord,
  type EngagementLetterRow,
  type FilingRecordRow,
} from "@/app/actions/engagements"
import { SERVICE_TYPE_LABELS } from "@/lib/clients/constants"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "border-white/10 bg-muted/30 text-muted-foreground",
  ISSUED: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  SIGNED: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  DECLINED: "border-red-500/25 bg-red-500/10 text-red-300",
  EXPIRED: "border-amber-500/25 bg-amber-500/10 text-amber-300",
}

/** "2025-26" for today, so the form opens on the year people mean. */
function currentFyLabel(): string {
  const now = new Date()
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`
}

const SERVICE_KEYS = Object.keys(SERVICE_TYPE_LABELS) as Array<
  keyof typeof SERVICE_TYPE_LABELS
>

export function EngagementTab({
  clientId,
  canManage,
}: {
  clientId: string
  canManage: boolean
}) {
  const [letters, setLetters] = useState<EngagementLetterRow[] | null>(null)
  const [filings, setFilings] = useState<FilingRecordRow[] | null>(null)
  const [letterOpen, setLetterOpen] = useState(false)
  const [filingOpen, setFilingOpen] = useState(false)
  const [editing, setEditing] = useState<EngagementLetterRow | null>(null)

  const load = useCallback(() => {
    getEngagementLetters(clientId).then(setLetters).catch(() => setLetters([]))
    getFilingRecords(clientId).then(setFilings).catch(() => setFilings([]))
  }, [clientId])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      {/* ── Engagement letters ─────────────────────────────────────────── */}
      <GlassCard hover={false} className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <FileSignature className="size-4 text-muted-foreground" />
              Engagement letters
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              The written terms this work is done under. SA 210 expects one agreed
              before the engagement starts, and a peer review asks to see it.
            </p>
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={() => { setEditing(null); setLetterOpen(true) }}
              className="gap-1.5"
            >
              <Plus className="size-3.5" />
              Record letter
            </Button>
          )}
        </div>

        {letters === null ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : letters.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-sm text-muted-foreground">
            No engagement letter on file. Without one there is no written record of
            what the firm agreed to do, or for how much.
          </p>
        ) : (
          <div className="space-y-2">
            {letters.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{l.financialYear}</span>
                    <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLE[l.status])}>
                      {l.status}
                    </Badge>
                    {l.daysToExpiry !== null && l.daysToExpiry <= 45 && (
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          l.daysToExpiry < 0 ? "text-red-400" : "text-amber-400"
                        )}
                      >
                        <AlertTriangle className="size-3" />
                        {l.daysToExpiry < 0
                          ? `Lapsed ${Math.abs(l.daysToExpiry)}d ago`
                          : `Lapses in ${l.daysToExpiry}d`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {l.serviceTypes.length > 0
                      ? l.serviceTypes
                          .map((s) => SERVICE_TYPE_LABELS[s as keyof typeof SERVICE_TYPE_LABELS] ?? s)
                          .join(" · ")
                      : "No services listed"}
                    {l.feeAgreed != null && (
                      <> · <span className="tabular-nums">₹{l.feeAgreed.toLocaleString("en-IN")}</span></>
                    )}
                    {l.signedAt && <> · Signed {format(new Date(l.signedAt), "d MMM yyyy")}</>}
                  </p>
                  {l.scope && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground/80">{l.scope}</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditing(l); setLetterOpen(true) }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label="Delete engagement letter"
                      onClick={async () => {
                        await deleteEngagementLetter(l.id)
                        load()
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* ── Filing history ─────────────────────────────────────────────── */}
      <GlassCard hover={false} className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <FileCheck2 className="size-4 text-muted-foreground" />
              Filing history
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              What has actually been filed, with the acknowledgement number.
              Record what a previous accountant filed too — otherwise this year
              starts with no idea what was already done.
            </p>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setFilingOpen(true)} className="gap-1.5">
              <Plus className="size-3.5" />
              Add filing
            </Button>
          )}
        </div>

        {filings === null ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : filings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Year</th>
                  <th className="pb-2 pr-3 font-medium">Filing</th>
                  <th className="pb-2 pr-3 font-medium">Period</th>
                  <th className="pb-2 pr-3 font-medium">Filed</th>
                  <th className="pb-2 pr-3 font-medium">Acknowledgement</th>
                  <th className="pb-2 pr-3 font-medium">By</th>
                  {canManage && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody>
                {filings.map((f) => (
                  <tr key={f.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2.5 pr-3 tabular-nums">{f.financialYear}</td>
                    <td className="py-2.5 pr-3 font-medium">{f.filingType}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{f.period ?? "—"}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                      {f.filedOn ? format(new Date(f.filedOn), "d MMM yyyy") : "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                      {f.acknowledgementNo ?? "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {f.filedByExternal ? (
                        <span className="text-amber-400/90">{f.filedByExternal}</span>
                      ) : (
                        "This firm"
                      )}
                    </td>
                    {canManage && (
                      <td className="py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          aria-label="Delete filing record"
                          onClick={async () => {
                            await deleteFilingRecord(f.id)
                            load()
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <EngagementLetterDialog
        clientId={clientId}
        letter={editing}
        open={letterOpen}
        onOpenChange={setLetterOpen}
        onSaved={load}
      />
      <FilingDialog
        clientId={clientId}
        open={filingOpen}
        onOpenChange={setFilingOpen}
        onSaved={load}
      />
    </div>
  )
}

function EngagementLetterDialog({
  clientId,
  letter,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string
  letter: EngagementLetterRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(() => blank())
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function blank() {
    return {
      financialYear: currentFyLabel(),
      serviceTypes: [] as string[],
      scope: "",
      feeAgreed: "",
      status: "DRAFT",
      issuedAt: "",
      signedAt: "",
      expiresAt: "",
      notes: "",
    }
  }

  useEffect(() => {
    if (!open) return
    setError("")
    setForm(
      letter
        ? {
            financialYear: letter.financialYear,
            serviceTypes: letter.serviceTypes,
            scope: letter.scope ?? "",
            feeAgreed: letter.feeAgreed != null ? String(letter.feeAgreed) : "",
            status: letter.status,
            issuedAt: letter.issuedAt?.slice(0, 10) ?? "",
            signedAt: letter.signedAt?.slice(0, 10) ?? "",
            expiresAt: letter.expiresAt?.slice(0, 10) ?? "",
            notes: letter.notes ?? "",
          }
        : blank()
    )
  }, [open, letter])

  function toggleService(key: string) {
    setForm((f) => ({
      ...f,
      serviceTypes: f.serviceTypes.includes(key)
        ? f.serviceTypes.filter((s) => s !== key)
        : [...f.serviceTypes, key],
    }))
  }

  function submit() {
    setError("")
    startTransition(async () => {
      const result = await saveEngagementLetter({ ...form, clientId }, letter?.id)
      if (!result.success) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0]?.[0] ??
            "Could not save."
        )
        return
      }
      onSaved()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{letter ? "Edit engagement letter" : "Record engagement letter"}</DialogTitle>
          <DialogDescription>
            What the firm agreed to do, for whom, at what fee, and until when.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="el-fy">Financial year</Label>
              <Input
                id="el-fy"
                value={form.financialYear}
                onChange={(e) => setForm({ ...form, financialYear: e.target.value })}
                placeholder="2025-26"
                className="input-premium mt-2 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="el-status">Status</Label>
              <select
                id="el-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-premium mt-2 h-10 w-full rounded-xl px-3 text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="ISSUED">Issued to client</option>
                <option value="SIGNED">Signed</option>
                <option value="DECLINED">Declined</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Services covered</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SERVICE_KEYS.map((key) => {
                const on = form.serviceTypes.includes(key)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleService(key)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                      on
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-white/[0.1] text-muted-foreground hover:border-white/25"
                    )}
                  >
                    {SERVICE_TYPE_LABELS[key]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Anything not listed here is outside the agreed scope.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="el-issued">Issued</Label>
              <Input
                id="el-issued"
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
                className="input-premium mt-2 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="el-signed">Signed</Label>
              <Input
                id="el-signed"
                type="date"
                value={form.signedAt}
                onChange={(e) => setForm({ ...form, signedAt: e.target.value })}
                className="input-premium mt-2 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="el-expires">Lapses</Label>
              <Input
                id="el-expires"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="input-premium mt-2 h-10 rounded-xl"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="el-fee">Fee stated in the letter (₹, excl. GST)</Label>
            <Input
              id="el-fee"
              type="number"
              min="0"
              value={form.feeAgreed}
              onChange={(e) => setForm({ ...form, feeAgreed: e.target.value })}
              placeholder="Optional"
              className="input-premium mt-2 h-10 rounded-xl tabular-nums"
            />
          </div>

          <div>
            <Label htmlFor="el-scope">Scope and exclusions</Label>
            <Textarea
              id="el-scope"
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              rows={3}
              placeholder="e.g. Statutory audit for FY 2025-26. Excludes tax representation and transfer pricing."
              className="input-premium mt-2 rounded-xl"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FilingDialog({
  clientId,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    financialYear: currentFyLabel(),
    filingType: "",
    period: "",
    filedOn: "",
    acknowledgementNo: "",
    filedByExternal: "",
    notes: "",
  })
  const [byPrevious, setByPrevious] = useState(false)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setError("")
    setByPrevious(false)
    setForm({
      financialYear: currentFyLabel(),
      filingType: "",
      period: "",
      filedOn: "",
      acknowledgementNo: "",
      filedByExternal: "",
      notes: "",
    })
  }, [open])

  function submit() {
    setError("")
    startTransition(async () => {
      const result = await saveFilingRecord({
        ...form,
        clientId,
        // Blank means we filed it; the field only carries a value when the work
        // came from someone else.
        filedByExternal: byPrevious ? form.filedByExternal || "Previous accountant" : "",
      })
      if (!result.success) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0]?.[0] ??
            "Could not save."
        )
        return
      }
      onSaved()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record a filing</DialogTitle>
          <DialogDescription>
            Something that has already been submitted — by this firm or by whoever
            handled the client before.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fr-fy">Financial year</Label>
              <Input
                id="fr-fy"
                value={form.financialYear}
                onChange={(e) => setForm({ ...form, financialYear: e.target.value })}
                placeholder="2024-25"
                className="input-premium mt-2 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="fr-period">Period</Label>
              <Input
                id="fr-period"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                placeholder="Q2 / Apr 2025 / Annual"
                className="input-premium mt-2 h-10 rounded-xl"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="fr-type">What was filed</Label>
            <Input
              id="fr-type"
              value={form.filingType}
              onChange={(e) => setForm({ ...form, filingType: e.target.value })}
              placeholder="GSTR-3B, ITR-6, 24Q, AOC-4…"
              className="input-premium mt-2 h-10 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fr-date">Filed on</Label>
              <Input
                id="fr-date"
                type="date"
                value={form.filedOn}
                onChange={(e) => setForm({ ...form, filedOn: e.target.value })}
                className="input-premium mt-2 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="fr-ack">Acknowledgement no.</Label>
              <Input
                id="fr-ack"
                value={form.acknowledgementNo}
                onChange={(e) => setForm({ ...form, acknowledgementNo: e.target.value })}
                placeholder="ARN / receipt no."
                className="input-premium mt-2 h-10 rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <input
              type="checkbox"
              checked={byPrevious}
              onChange={(e) => setByPrevious(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <div className="min-w-0">
              <p className="text-sm">Filed by a previous accountant</p>
              {byPrevious && (
                <Input
                  value={form.filedByExternal}
                  onChange={(e) => setForm({ ...form, filedByExternal: e.target.value })}
                  placeholder="Their firm's name"
                  className="input-premium mt-2 h-9 rounded-xl"
                />
              )}
            </div>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !form.filingType.trim()} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
