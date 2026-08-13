"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Loader2,
  Mail,
  Pencil,
  Phone,
  MessageCircle,
  Plus,
  Star,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react"

import { buildWhatsAppUrl } from "@/lib/messaging/whatsapp-link"
import { draftGeneral } from "@/lib/messaging/whatsapp-drafts"
import { toast } from "sonner"

import {
  addTeamMember,
  createContact,
  deleteContact,
  getEmployeeOptions,
  listContacts,
  listTeam,
  removeTeamMember,
  setPrimaryContact,
  updateContact,
  type ContactInput,
  type ContactItem,
  type TeamMemberItem,
} from "@/app/actions/contacts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  CONTACT_ROLES,
  TEAM_ROLES,
  TEAM_ROLE_BADGE_CLASSES,
  TEAM_ROLE_LABELS,
  type TeamRoleValue,
} from "@/lib/clients/master-data"
import { cn } from "@/lib/utils"
import { ALL_SERVICE_TYPES, SERVICE_TYPE_LABELS } from "@/lib/clients/constants"

type EmployeeOption = { id: string; name: string; department: string | null }

type ClientContactsTeamTabProps = {
  clientId: string
  canManage: boolean
}

export function ClientContactsTeamTab({
  clientId,
  canManage,
}: ClientContactsTeamTabProps) {
  const [contacts, setContacts] = useState<ContactItem[] | null>(null)
  const [team, setTeam] = useState<TeamMemberItem[] | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [contactList, teamList] = await Promise.all([
        listContacts(clientId),
        listTeam(clientId),
      ])
      setContacts(contactList)
      setTeam(teamList)
    } catch {
      toast.error("Couldn't load contacts and team for this client.")
      setContacts((prev) => prev ?? [])
      setTeam((prev) => prev ?? [])
    }
  }, [clientId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="space-y-8">
      <ContactsSection
        clientId={clientId}
        canManage={canManage}
        contacts={contacts}
        onChanged={refresh}
      />
      <TeamSection
        clientId={clientId}
        canManage={canManage}
        team={team}
        onChanged={refresh}
      />
    </div>
  )
}

// ─── Contacts ────────────────────────────────────────────────────────────────

function ContactsSection({
  clientId,
  canManage,
  contacts,
  onChanged,
}: {
  clientId: string
  canManage: boolean
  contacts: ContactItem[] | null
  onChanged: () => Promise<void>
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ContactItem | null>(null)
  const [deleting, setDeleting] = useState<ContactItem | null>(null)
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null)

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleSetPrimary = async (contact: ContactItem) => {
    if (contact.isPrimary || settingPrimaryId) return
    setSettingPrimaryId(contact.id)
    try {
      const result = await setPrimaryContact(contact.id)
      if (result.success) {
        toast.success(`${contact.name} is now the primary contact`)
        await onChanged()
      } else {
        toast.error(result.error ?? "Failed to set primary contact")
      }
    } finally {
      setSettingPrimaryId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    const result = await deleteContact(deleting.id)
    if (result.success) {
      toast.success("Contact deleted")
      await onChanged()
    } else {
      toast.error(result.error ?? "Failed to delete contact")
    }
    setDeleting(null)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Contacts</h3>
          <p className="text-[13px] text-muted-foreground">
            Directors, signatories, and accountants on the client&apos;s side.
          </p>
        </div>
        {canManage && contacts !== null && contacts.length > 0 && (
          <Button size="sm" onClick={openAdd} className="btn-glow h-9 rounded-xl">
            <Plus className="size-3.5" />
            Add contact
          </Button>
        )}
      </div>

      {contacts === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add the people you coordinate with on this client — directors, CFOs, signatories, accountants."
          className="py-6"
          action={
            canManage
              ? { label: "Add first contact", onClick: openAdd }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleSetPrimary(contact)}
                  disabled={!canManage || contact.isPrimary || settingPrimaryId !== null}
                  title={
                    contact.isPrimary
                      ? "Primary contact"
                      : canManage
                        ? "Make primary contact"
                        : undefined
                  }
                  aria-label={
                    contact.isPrimary ? "Primary contact" : "Make primary contact"
                  }
                  className={cn(
                    "mt-0.5 shrink-0 rounded-lg p-1 transition-colors",
                    contact.isPrimary
                      ? "text-amber-400"
                      : "text-muted-foreground/40 hover:text-amber-400",
                    (!canManage || contact.isPrimary) && "cursor-default hover:text-current"
                  )}
                >
                  {settingPrimaryId === contact.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Star
                      className="size-4"
                      fill={contact.isPrimary ? "currentColor" : "none"}
                    />
                  )}
                </button>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {contact.name}
                    </span>
                    {contact.role && (
                      <Badge
                        variant="outline"
                        className="bg-primary/10 text-xs text-primary border-primary/20"
                      >
                        {contact.role}
                      </Badge>
                    )}
                    {contact.isPrimary && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-xs text-amber-400 border-amber-500/20"
                      >
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                      >
                        <Mail className="size-3.5" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                      >
                        <Phone className="size-3.5" />
                        {contact.phone}
                      </a>
                    )}
                    {buildWhatsAppUrl(contact.phone, draftGeneral({ clientName: contact.name })) && (
                      <a
                        href={
                          buildWhatsAppUrl(
                            contact.phone,
                            draftGeneral({ clientName: contact.name })
                          )!
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-emerald-500 transition-colors hover:text-emerald-400"
                      >
                        <MessageCircle className="size-3.5" />
                        WhatsApp
                      </a>
                    )}
                    {!contact.email && !contact.phone && (
                      <span className="text-muted-foreground/60">
                        No contact details
                      </span>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-xs leading-relaxed text-muted-foreground/70">
                      {contact.notes}
                    </p>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2"
                    aria-label={`Edit ${contact.name}`}
                    onClick={() => {
                      setEditing(contact)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg px-2 text-destructive hover:text-destructive"
                    aria-label={`Delete ${contact.name}`}
                    onClick={() => setDeleting(contact)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ContactFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        clientId={clientId}
        contact={editing}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete contact?"
        description={
          deleting
            ? `"${deleting.name}" will be removed from this client's contact list.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </section>
  )
}

function ContactFormDialog({
  open,
  onOpenChange,
  clientId,
  contact,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  contact: ContactItem | null
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(contact?.name ?? "")
  const [role, setRole] = useState(contact?.role ?? "")
  const [email, setEmail] = useState(contact?.email ?? "")
  const [phone, setPhone] = useState(contact?.phone ?? "")
  const [notes, setNotes] = useState(contact?.notes ?? "")
  const [isPrimary, setIsPrimary] = useState(contact?.isPrimary ?? false)
  const [handles, setHandles] = useState<string[]>(contact?.handles ?? [])
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const isEdit = contact !== null

  const resetForm = () => {
    setName("")
    setRole("")
    setEmail("")
    setPhone("")
    setNotes("")
    setIsPrimary(false)
    setHandles([])
    setFieldErrors({})
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setFieldErrors({})
    try {
      const input: ContactInput = {
        name,
        role: role || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        isPrimary,
        handles: handles as never,
      }
      const result = isEdit
        ? await updateContact(contact.id, input)
        : await createContact(clientId, input)

      if (result.success) {
        toast.success(isEdit ? "Contact updated" : "Contact added")
        onOpenChange(false)
        if (!isEdit) resetForm()
        await onSaved()
      } else if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
      } else {
        toast.error(result.error ?? "Failed to save contact")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit contact" : "Add contact"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this person's details."
              : "Add a person on the client's side you coordinate with."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name" className="text-[13px]">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={pending}
              className="input-premium h-10 rounded-xl"
            />
            {fieldErrors.name?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-role" className="text-[13px]">
                Role
              </Label>
              <select
                id="contact-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={pending}
                className="input-premium h-10 w-full rounded-xl px-3 text-sm"
              >
                <option value="">No role</option>
                {CONTACT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[13px]">Handles which work</Label>
              {/* Routing, not decoration: a GST reminder should reach the
                  person who actually does the GST, not the one address on the
                  client record. */}
              <div className="flex flex-wrap gap-1.5">
                {ALL_SERVICE_TYPES.map((key) => {
                  const on = handles.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setHandles((h) =>
                          h.includes(key) ? h.filter((x) => x !== key) : [...h, key]
                        )
                      }
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
              <p className="text-xs text-muted-foreground">
                Leave all unselected for a general contact.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone" className="text-[13px]">
                Phone
              </Label>
              <Input
                id="contact-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={pending}
                className="input-premium h-10 rounded-xl"
              />
              {fieldErrors.phone?.[0] && (
                <p className="text-xs text-destructive">{fieldErrors.phone[0]}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-[13px]">
              Email
            </Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className="input-premium h-10 rounded-xl"
            />
            {fieldErrors.email?.[0] && (
              <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-notes" className="text-[13px]">
              Notes
            </Label>
            <Textarea
              id="contact-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
              className="input-premium min-h-[72px] rounded-xl"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked === true)}
              disabled={pending}
            />
            Primary contact
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="input-premium h-10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="btn-glow h-10 rounded-xl px-6"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Add contact"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Engagement team ─────────────────────────────────────────────────────────

function TeamSection({
  clientId,
  canManage,
  team,
  onChanged,
}: {
  clientId: string
  canManage: boolean
  team: TeamMemberItem[] | null
  onChanged: () => Promise<void>
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<TeamMemberItem | null>(null)

  const handleRemove = async () => {
    if (!removing) return
    const result = await removeTeamMember(removing.id)
    if (result.success) {
      toast.success("Team member removed")
      await onChanged()
    } else {
      toast.error(result.error ?? "Failed to remove team member")
    }
    setRemoving(null)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Engagement team
          </h3>
          <p className="text-[13px] text-muted-foreground">
            Who signs, reviews, and prepares work for this client.
          </p>
        </div>
        {canManage && team !== null && team.length > 0 && (
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="btn-glow h-9 rounded-xl"
          >
            <UserPlus className="size-3.5" />
            Add member
          </Button>
        )}
      </div>

      {team === null ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ) : team.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No engagement team yet"
          description="Assign an engagement partner, review manager, and preparers so responsibility on this client is clear."
          className="py-6"
          action={
            canManage
              ? { label: "Add first member", onClick: () => setAddOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {team.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    TEAM_ROLE_BADGE_CLASSES[member.role as TeamRoleValue] ??
                      TEAM_ROLE_BADGE_CLASSES.PREPARER
                  )}
                >
                  {TEAM_ROLE_LABELS[member.role as TeamRoleValue] ?? member.role}
                </Badge>
                <span className="truncate text-sm font-medium">
                  {member.employeeName}
                </span>
                {member.employeeDepartment && (
                  <span className="text-xs text-muted-foreground">
                    {member.employeeDepartment}
                  </span>
                )}
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 rounded-lg px-2 text-destructive hover:text-destructive"
                  aria-label={`Remove ${member.employeeName}`}
                  onClick={() => setRemoving(member)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AddTeamMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={clientId}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove team member?"
        description={
          removing
            ? `${removing.employeeName} will no longer be ${
                TEAM_ROLE_LABELS[removing.role as TeamRoleValue] ?? removing.role
              } on this client.`
            : ""
        }
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
      />
    </section>
  )
}

function AddTeamMemberDialog({
  open,
  onOpenChange,
  clientId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  onSaved: () => Promise<void>
}) {
  const [employees, setEmployees] = useState<EmployeeOption[] | null>(null)
  const [employeeId, setEmployeeId] = useState("")
  const [role, setRole] = useState<TeamRoleValue>("PREPARER")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!open || employees !== null) return
    getEmployeeOptions()
      .then(setEmployees)
      .catch(() => {
        toast.error("Couldn't load the employee list.")
        setEmployees([])
      })
  }, [open, employees])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    if (!employeeId) {
      toast.error("Select an employee first.")
      return
    }
    setPending(true)
    try {
      const result = await addTeamMember(clientId, employeeId, role)
      if (result.success) {
        toast.success("Team member added")
        onOpenChange(false)
        setEmployeeId("")
        setRole("PREPARER")
        await onSaved()
      } else {
        toast.error(result.error ?? "Failed to add team member")
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Assign an employee a role on this client&apos;s engagement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-employee" className="text-[13px]">
              Employee <span className="text-destructive">*</span>
            </Label>
            <select
              id="team-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              disabled={pending || employees === null}
              className="input-premium h-10 w-full rounded-xl px-3 text-sm"
            >
              <option value="">
                {employees === null ? "Loading employees..." : "Select employee"}
              </option>
              {(employees ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.department ? ` - ${employee.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-role" className="text-[13px]">
              Role
            </Label>
            <select
              id="team-role"
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRoleValue)}
              disabled={pending}
              className="input-premium h-10 w-full rounded-xl px-3 text-sm"
            >
              {TEAM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {TEAM_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="input-premium h-10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="btn-glow h-10 rounded-xl px-6"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add member"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
