"use client"

/**
 * Client Groups — create groups and assign clients to them. Reads are
 * staff-wide; create/rename/delete/assign are Partner/Manager (canManage).
 */

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Boxes, Building2, Loader2, Pencil, Plus, Trash2, Users } from "lucide-react"
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
  createGroup,
  renameGroup,
  deleteGroup,
  setClientsGroup,
  type GroupRow,
} from "@/app/actions/groups"
import { cn } from "@/lib/utils"

type AssignableClient = {
  id: string
  name: string
  clientCode: string
  groupId: string | null
  groupName: string | null
}

export function GroupsClient({
  initialGroups,
  clients,
  canManage,
}: {
  initialGroups: GroupRow[]
  clients: AssignableClient[]
  canManage: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<null | { id?: string; name: string; notes: string }>(null)
  const [assigning, setAssigning] = useState<null | GroupRow>(null)
  const [confirmDelete, setConfirmDelete] = useState<null | GroupRow>(null)
  const [saving, setSaving] = useState(false)

  const groupedCount = useMemo(() => clients.filter((c) => c.groupId).length, [clients])

  async function saveGroup() {
    if (!editing) return
    setSaving(true)
    try {
      const res = editing.id
        ? await renameGroup(editing.id, { name: editing.name, notes: editing.notes })
        : await createGroup({ name: editing.name, notes: editing.notes })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(editing.id ? "Group updated." : "Group created.")
      setEditing(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function removeGroup() {
    if (!confirmDelete) return
    const res = await deleteGroup(confirmDelete.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Group deleted — its clients were ungrouped.")
    setConfirmDelete(null)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Summary + create */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="surface-elevated rounded-xl border border-white/[0.06] px-4 py-3">
          <p className="text-xs text-muted-foreground">Groups</p>
          <p className="text-2xl font-semibold">{initialGroups.length}</p>
        </div>
        <div className="surface-elevated rounded-xl border border-white/[0.06] px-4 py-3">
          <p className="text-xs text-muted-foreground">Clients grouped</p>
          <p className="text-2xl font-semibold">
            {groupedCount}
            <span className="text-sm font-normal text-muted-foreground"> / {clients.length}</span>
          </p>
        </div>
        <div className="flex-1" />
        {canManage && (
          <Button
            className="btn-glow gap-1.5 rounded-xl"
            onClick={() => setEditing({ name: "", notes: "" })}
          >
            <Plus className="size-4" /> New group
          </Button>
        )}
      </div>

      {/* Groups */}
      {initialGroups.length === 0 ? (
        <div className="surface-elevated flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] px-4 py-12 text-center">
          <Boxes className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No client groups yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Create a group to bundle a promoter&apos;s companies or a family&apos;s entities, then assign clients to it.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialGroups.map((g) => (
            <div key={g.id} className="surface-elevated flex flex-col rounded-2xl border border-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Boxes className="size-4 shrink-0 text-primary" />
                    <h3 className="truncate font-semibold">{g.name}</h3>
                  </div>
                  {g.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.notes}</p>}
                </div>
                <Badge className="shrink-0 gap-1 border-white/10 bg-white/[0.04] text-muted-foreground">
                  <Users className="size-3" /> {g.clientCount}
                </Badge>
              </div>

              <div className="mt-3 flex-1 space-y-1">
                {g.clients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No clients assigned.</p>
                ) : (
                  g.clients.slice(0, 6).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <Building2 className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{c.clientCode}</span>
                    </div>
                  ))
                )}
                {g.clients.length > 6 && (
                  <p className="text-[11px] text-muted-foreground">+{g.clients.length - 6} more</p>
                )}
              </div>

              {canManage && (
                <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                  <Button variant="outline" size="sm" className="input-premium h-8 flex-1 gap-1.5 rounded-lg text-xs" onClick={() => setAssigning(g)}>
                    <Users className="size-3" /> Manage clients
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="size-8" aria-label="Rename group" onClick={() => setEditing({ id: g.id, name: g.name, notes: g.notes ?? "" })}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="size-8 text-muted-foreground hover:text-destructive" aria-label="Delete group" onClick={() => setConfirmDelete(g)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / rename dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="border-white/[0.08] bg-popover/95 backdrop-blur-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Rename group" : "New client group"}</DialogTitle>
            <DialogDescription>Group companies, families, or entities under a shared promoter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Group name *</span>
              <Input
                autoFocus
                value={editing?.name ?? ""}
                onChange={(e) => setEditing((s) => (s ? { ...s, name: e.target.value } : s))}
                placeholder="e.g. Sharma Group / Acme Holdings"
                className="input-premium h-9 rounded-xl"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-muted-foreground">Notes</span>
              <Textarea
                value={editing?.notes ?? ""}
                onChange={(e) => setEditing((s) => (s ? { ...s, notes: e.target.value } : s))}
                className="input-premium min-h-16 rounded-xl"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" className="input-premium rounded-xl" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="btn-glow rounded-xl" disabled={saving || !editing?.name.trim()} onClick={() => void saveGroup()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} {editing?.id ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage-clients dialog */}
      {assigning && (
        <ManageClientsDialog
          group={assigning}
          clients={clients}
          onClose={() => setAssigning(null)}
          onSaved={() => {
            setAssigning(null)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this group?"
        description={confirmDelete ? `"${confirmDelete.name}" will be removed. Its ${confirmDelete.clientCount} client(s) stay — they just become ungrouped.` : ""}
        confirmLabel="Delete group"
        destructive
        onConfirm={() => void removeGroup()}
      />
    </div>
  )
}

function ManageClientsDialog({
  group,
  clients,
  onClose,
  onSaved,
}: {
  group: GroupRow
  clients: AssignableClient[]
  onClose: () => void
  onSaved: () => void
}) {
  const memberIds = useMemo(() => new Set(group.clients.map((c) => c.id)), [group.clients])
  const [selected, setSelected] = useState<Set<string>>(new Set(memberIds))
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => !q || c.name.toLowerCase().includes(q) || c.clientCode.toLowerCase().includes(q))
  }, [clients, query])

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const toAdd = [...selected].filter((id) => !memberIds.has(id))
      const toRemove = [...memberIds].filter((id) => !selected.has(id))
      const results = await Promise.all([
        toAdd.length ? setClientsGroup(group.id, toAdd) : Promise.resolve({ success: true }),
        toRemove.length ? setClientsGroup(null, toRemove) : Promise.resolve({ success: true }),
      ])
      const err = results.find((r) => "error" in r && r.error)
      if (err && "error" in err) {
        toast.error(err.error!)
        return
      }
      if (!toAdd.length && !toRemove.length) {
        toast.info("No changes.")
        onClose()
        return
      }
      toast.success("Group membership updated.")
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-white/[0.08] bg-popover/95 backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage clients — {group.name}</DialogTitle>
          <DialogDescription>
            Tick the clients that belong to this group. A client can only be in one group; ticking it moves it here.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="input-premium h-9 rounded-xl"
        />

        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {filtered.map((c) => {
            const checked = selected.has(c.id)
            const inOther = c.groupId && c.groupId !== group.id
            return (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                  checked ? "border-primary/40 bg-primary/[0.06]" : "border-white/[0.06] hover:bg-white/[0.02]"
                )}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} className="size-4 accent-primary" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{c.clientCode}</span>
                {inOther && !checked && (
                  <Badge className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400">in {c.groupName}</Badge>
                )}
              </label>
            )
          })}
          {filtered.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No clients match.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" className="input-premium rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="btn-glow rounded-xl" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null} Save membership
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
