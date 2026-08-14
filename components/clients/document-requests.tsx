"use client"

/**
 * Document chasing, as a tracked ask rather than a private note.
 *
 * The DocumentRequest tables have existed since the beginning with no interface
 * at all, so staff tracked outstanding documents in whichever of the two live
 * checklists they happened to open, and the client never saw either.
 *
 * A request is raised FROM the client's standing checklist — the uncollected
 * entries are pre-ticked — so this is a round of chasing against that register,
 * not a competing list. Accepting an item marks the checklist entry collected.
 */

import { useCallback, useEffect, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  AlertTriangle,
  Check,
  Loader2,
  Mail,
  Plus,
  Send,
  X,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

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
import { getClientChecklist } from "@/app/actions/document-checklist"
import {
  closeDocumentRequest,
  createDocumentRequest,
  getDocumentRequests,
  sendDocumentRequestReminder,
  setRequestItemStatus,
  getRequestedDocumentUrl,
  type DocumentRequestRow,
} from "@/app/actions/document-requests"
import { cn } from "@/lib/utils"

export function DocumentRequests({
  clientId,
  canManage,
}: {
  clientId: string
  canManage: boolean
}) {
  const [requests, setRequests] = useState<DocumentRequestRow[] | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [busyItem, setBusyItem] = useState<string | null>(null)

  const load = useCallback(() => {
    getDocumentRequests(clientId).then(setRequests).catch(() => setRequests([]))
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function toggleItem(itemId: string, current: string) {
    setBusyItem(itemId)
    try {
      const next = current === "ACCEPTED" ? "PENDING" : "ACCEPTED"
      const result = await setRequestItemStatus(itemId, next)
      if (!result.success) {
        toast.error(result.error ?? "Could not update that item.")
        return
      }
      load()
    } finally {
      setBusyItem(null)
    }
  }

  /**
   * Signed links expire, so one is fetched at the moment of the click rather
   * than rendered into the page for every row.
   */
  async function openDocument(itemId: string) {
    const result = await getRequestedDocumentUrl(itemId)
    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not open that file.")
      return
    }
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  async function remind(requestId: string) {
    setBusyItem(requestId)
    try {
      const result = await sendDocumentRequestReminder(requestId)
      if (!result.success) {
        toast.error(result.error ?? "Could not send the reminder.")
        return
      }
      toast.success(`Reminder sent to ${result.sentTo}.`)
      load()
    } finally {
      setBusyItem(null)
    }
  }

  const open = requests?.filter((r) => r.status === "OPEN") ?? []
  const done = requests?.filter((r) => r.status !== "OPEN") ?? []

  return (
    <GlassCard hover={false} className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Waiting on the client</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            What has been asked for, when, and what has come back. The client sees
            the outstanding items in their portal.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setComposeOpen(true)} className="gap-1.5">
            <Plus className="size-3.5" />
            Request documents
          </Button>
        )}
      </div>

      {requests === null ? (
        <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : requests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing outstanding. Raise a request and the client can see exactly what
          you need instead of working it out from an email thread.
        </p>
      ) : (
        <div className="space-y-3">
          {[...open, ...done].map((r) => (
            <div
              key={r.id}
              className={cn(
                "rounded-xl border p-4",
                r.overdue
                  ? "border-red-500/25 bg-red-500/[0.05]"
                  : "border-white/[0.08] bg-white/[0.02]"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        r.status === "COMPLETED"
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : r.status === "CANCELLED"
                            ? "border-white/10 bg-muted/30 text-muted-foreground"
                            : "border-blue-500/25 bg-blue-500/10 text-blue-300"
                      )}
                    >
                      {r.status}
                    </Badge>
                    {r.overdue && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle className="size-3" />
                        Past due
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.outstanding} of {r.items.length} still outstanding
                    {r.dueDate && ` · asked for by ${format(new Date(r.dueDate), "d MMM yyyy")}`}
                    {r.lastRemindedAt &&
                      ` · last chased ${format(new Date(r.lastRemindedAt), "d MMM")}`}
                  </p>
                </div>

                {canManage && r.status === "OPEN" && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={busyItem === r.id || r.outstanding === 0}
                      onClick={() => remind(r.id)}
                    >
                      {busyItem === r.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Mail className="size-3.5" />
                      )}
                      {r.lastRemindedAt ? "Chase again" : "Send"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label="Cancel request"
                      onClick={async () => {
                        await closeDocumentRequest(r.id)
                        load()
                      }}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <ul className="mt-3 space-y-1">
                {r.items.map((item) => {
                  const received = item.status === "ACCEPTED"
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={!canManage || busyItem === item.id}
                        onClick={() => toggleItem(item.id, item.status)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                          canManage && "hover:bg-white/[0.03]"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                            received
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-muted-foreground/40"
                          )}
                        >
                          {received && <Check className="size-3" />}
                        </span>
                        <span className={cn(received && "text-muted-foreground line-through")}>
                          {item.title}
                        </span>
                        {busyItem === item.id && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </button>

                      {/* What the client actually sent. Until the portal could
                          upload, an item only ever had a tick-box; now a
                          reviewer needs to open the file before accepting it,
                          and "UPLOADED" with nothing to click was the gap. */}
                      {item.fileName && (
                        <div className="ml-8 flex items-center gap-2 pb-1 text-xs text-muted-foreground">
                          <FileText className="size-3 shrink-0" aria-hidden />
                          <button
                            type="button"
                            className="truncate underline-offset-4 hover:text-foreground hover:underline"
                            onClick={() => void openDocument(item.id)}
                          >
                            {item.fileName}
                          </button>
                          {item.status === "UPLOADED" && (
                            <span className="shrink-0 text-amber-400">waiting on review</span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ComposeRequestDialog
        clientId={clientId}
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onCreated={load}
      />
    </GlassCard>
  )
}

function ComposeRequestDialog({
  clientId,
  open,
  onOpenChange,
  onCreated,
}: {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [extra, setExtra] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setTitle("")
    setDueDate("")
    setNotes("")
    setExtra("")
    setError("")
    // Seed from the client's standing checklist: whatever is still uncollected
    // is, by definition, what we are waiting on. This is what stops the request
    // being a fourth independent list.
    getClientChecklist(clientId)
      .then((items) => {
        const outstanding = items.filter((i) => !i.collected).map((i) => i.label)
        setSuggestions(outstanding)
        setSelected(outstanding)
      })
      .catch(() => {
        setSuggestions([])
        setSelected([])
      })
  }, [open, clientId])

  function toggle(label: string) {
    setSelected((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]))
  }

  function addExtra() {
    const label = extra.trim()
    if (!label) return
    if (!suggestions.includes(label)) setSuggestions((s) => [...s, label])
    if (!selected.includes(label)) setSelected((s) => [...s, label])
    setExtra("")
  }

  function submit() {
    setError("")
    startTransition(async () => {
      const result = await createDocumentRequest({
        clientId,
        title: title.trim() || "Documents needed",
        dueDate,
        notes,
        items: selected,
      })
      if (!result.success) {
        setError(result.error ?? "Could not create the request.")
        return
      }
      onCreated()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request documents</DialogTitle>
          <DialogDescription>
            Pre-filled from what is still outstanding on this client&apos;s checklist.
            Marking an item received here ticks it there too.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="dr-title">What this is for</Label>
            <Input
              id="dr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GSTR-3B for September"
              className="input-premium mt-2 h-10 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="dr-due">Needed by</Label>
            <Input
              id="dr-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input-premium mt-2 h-10 rounded-xl"
            />
          </div>

          <div>
            <Label>Documents</Label>
            {suggestions.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Nothing outstanding on the checklist — add what you need below.
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                {suggestions.map((label) => (
                  <label
                    key={label}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(label)}
                      onChange={() => toggle(label)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <Input
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addExtra()
                  }
                }}
                placeholder="Add something else…"
                className="input-premium h-9 rounded-xl"
              />
              <Button type="button" variant="outline" size="sm" onClick={addExtra}>
                Add
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="dr-notes">Note to the client</Label>
            <Textarea
              id="dr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional — appears in the reminder email."
              className="input-premium mt-2 rounded-xl"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || selected.length === 0}
            className="gap-2"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Create request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
