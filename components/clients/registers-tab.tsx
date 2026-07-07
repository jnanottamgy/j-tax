"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  Hash,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ScrollText,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  deleteCredential,
  listClientCredentials,
  revealCredentialPassword,
  upsertCredential,
  type CredentialRow,
} from "@/app/actions/credentials"
import {
  createUdinRecord,
  deleteDscRecord,
  deleteRegistration,
  getRegisterSummary,
  listClientDscRecords,
  listClientRegistrations,
  listClientUdinRecords,
  upsertDscRecord,
  upsertRegistration,
  type DscRow,
  type RegisterSummary,
  type RegistrationRow,
  type UdinRow,
} from "@/app/actions/registers"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CREDENTIAL_PORTALS,
  CREDENTIAL_PORTAL_LABELS,
  DSC_CLASSES,
  DSC_CLASS_LABELS,
  DSC_STATUSES,
  DSC_STATUS_LABELS,
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_TYPES,
  REGISTRATION_TYPE_LABELS,
  type CredentialPortal,
  type DscClass,
  type DscStatus,
  type RegistrationStatus,
  type RegistrationType,
} from "@/lib/registers/constants"
import { cn } from "@/lib/utils"

// ─── Shared helpers ──────────────────────────────────────────────────────────

const REVEAL_TTL_MS = 15_000
const EXPIRY_WARN_DAYS = 60
const DAY_MS = 86_400_000

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

/** Red once past, amber inside the warning window. */
function expiryTone(value: Date | string | null | undefined): string {
  if (!value) return "text-muted-foreground"
  const diff = new Date(value).getTime() - Date.now()
  if (diff < 0) return "font-medium text-red-400"
  if (diff <= EXPIRY_WARN_DAYS * DAY_MS) return "font-medium text-amber-300"
  return "text-muted-foreground"
}

function RegisterStatusBadge({ status, label }: { status: string; label?: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-500/12 text-emerald-300 border-emerald-500/25"
      : status === "EXPIRED" || status === "REVOKED"
        ? "bg-red-500/12 text-red-300 border-red-500/25"
        : "bg-muted/60 text-foreground/90 border-white/15"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        tone
      )}
    >
      {label ?? status}
    </span>
  )
}

function Field({
  label,
  name,
  required,
  error,
  className,
  children,
}: {
  label: string
  name?: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name} className="text-[13px]">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      {children}
    </div>
  )
}

function SectionLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Loading…
    </div>
  )
}

function SectionError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  )
}

const inputClass = "input-premium h-10 rounded-xl"
const selectClass = "input-premium h-10 w-full rounded-xl px-3 text-sm"

// ─── Main tab ────────────────────────────────────────────────────────────────

export function ClientRegistersTab({
  clientId,
  canManage,
}: {
  clientId: string
  canManage: boolean
}) {
  const [summary, setSummary] = useState<RegisterSummary | null>(null)

  const refreshSummary = useCallback(async () => {
    const result = await getRegisterSummary(clientId)
    if (result.summary) setSummary(result.summary)
  }, [clientId])

  useEffect(() => {
    void refreshSummary()
  }, [refreshSummary])

  const count = (n: number | undefined) => (n === undefined ? "" : ` (${n})`)

  return (
    <Tabs defaultValue={canManage ? "vault" : "registrations"} className="gap-4">
      <TabsList className="max-w-full flex-wrap">
        {/* Vault tab is hidden entirely for non-managers — defense in depth,
            the server actions enforce Partner/Manager regardless. */}
        {canManage && (
          <TabsTrigger value="vault">
            <KeyRound aria-hidden />
            Credentials{count(summary?.credentials)}
          </TabsTrigger>
        )}
        <TabsTrigger value="registrations">
          <ScrollText aria-hidden />
          Registrations{count(summary?.registrations)}
        </TabsTrigger>
        <TabsTrigger value="dsc">
          <Fingerprint aria-hidden />
          DSC{count(summary?.dscs)}
        </TabsTrigger>
        <TabsTrigger value="udin">
          <Hash aria-hidden />
          UDIN{count(summary?.udins)}
        </TabsTrigger>
      </TabsList>

      {canManage && (
        <TabsContent value="vault">
          <CredentialVaultSection clientId={clientId} onChanged={refreshSummary} />
        </TabsContent>
      )}
      <TabsContent value="registrations">
        <RegistrationsSection
          clientId={clientId}
          canManage={canManage}
          onChanged={refreshSummary}
        />
      </TabsContent>
      <TabsContent value="dsc">
        <DscSection clientId={clientId} canManage={canManage} onChanged={refreshSummary} />
      </TabsContent>
      <TabsContent value="udin">
        <UdinSection clientId={clientId} canManage={canManage} onChanged={refreshSummary} />
      </TabsContent>
    </Tabs>
  )
}

// ─── Credential vault ────────────────────────────────────────────────────────

function CredentialVaultSection({
  clientId,
  onChanged,
}: {
  clientId: string
  onChanged: () => void
}) {
  const [rows, setRows] = useState<CredentialRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [vaultKeyMissing, setVaultKeyMissing] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealPendingId, setRevealPendingId] = useState<string | null>(null)
  const timersRef = useRef<Record<string, number>>({})

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CredentialRow | null>(null)
  const [deleting, setDeleting] = useState<CredentialRow | null>(null)

  const load = useCallback(async () => {
    const result = await listClientCredentials(clientId)
    if (result.error) {
      setLoadError(result.error)
    } else {
      setRows(result.credentials ?? [])
      setLoadError(null)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  // Clear all auto-hide timers on unmount.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      Object.values(timers).forEach((t) => window.clearTimeout(t))
    }
  }, [])

  const hidePassword = useCallback((id: string) => {
    window.clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setRevealed((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const handleReveal = async (id: string) => {
    if (revealPendingId) return
    setRevealPendingId(id)
    try {
      const result = await revealCredentialPassword(id)
      if (result.error) {
        if (result.error.includes("CREDENTIAL_VAULT_KEY")) {
          setVaultKeyMissing(true)
        } else {
          toast.error(result.error)
        }
        return
      }
      if (typeof result.password === "string") {
        setRevealed((prev) => ({ ...prev, [id]: result.password as string }))
        window.clearTimeout(timersRef.current[id])
        timersRef.current[id] = window.setTimeout(() => hidePassword(id), REVEAL_TTL_MS)
      }
    } finally {
      setRevealPendingId(null)
    }
  }

  const handleCopy = async (id: string) => {
    const password = revealed[id]
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      toast.success("Password copied to clipboard")
    } catch {
      toast.error("Could not copy to clipboard")
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    const result = await deleteCredential(deleting.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Credential deleted")
    setDeleting(null)
    hidePassword(deleting.id)
    await load()
    onChanged()
  }

  if (loadError) return <SectionError message={loadError} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-300" aria-hidden />
          Passwords are encrypted at rest. Viewed events are logged.
        </p>
        <Button
          size="sm"
          className="btn-glow rounded-xl"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus aria-hidden />
          Add credential
        </Button>
      </div>

      {vaultKeyMissing && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
        >
          The credential vault key is not configured. Set{" "}
          <code className="font-mono">CREDENTIAL_VAULT_KEY</code> (64 hex characters) in the
          server environment to enable password reveal.
        </div>
      )}

      {rows === null ? (
        <SectionLoading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No credentials stored"
          description="Store this client's portal logins (GST, Income Tax, MCA…) in the encrypted vault so the team never chases passwords again."
          action={{
            label: "Add credential",
            onClick: () => {
              setEditing(null)
              setDialogOpen(true)
            },
          }}
        />
      ) : (
        <SectionShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Portal</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Login URL</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const password = revealed[row.id]
                const pending = revealPendingId === row.id
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="font-medium">
                        {CREDENTIAL_PORTAL_LABELS[row.portal as CredentialPortal] ?? row.portal}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">{row.username}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[13px]">
                          {password ?? "••••••••"}
                        </span>
                        {password ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleCopy(row.id)}
                              title="Copy password"
                            >
                              <Copy aria-hidden />
                              <span className="sr-only">Copy password</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => hidePassword(row.id)}
                              title="Hide password"
                            >
                              <EyeOff aria-hidden />
                              <span className="sr-only">Hide password</span>
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={pending}
                            onClick={() => handleReveal(row.id)}
                            title="Reveal password (logged)"
                          >
                            {pending ? (
                              <Loader2 className="animate-spin" aria-hidden />
                            ) : (
                              <Eye aria-hidden />
                            )}
                            <span className="sr-only">Reveal password</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.loginUrl ? (
                        <a
                          href={row.loginUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Open portal
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(row)
                            setDialogOpen(true)
                          }}
                          title="Edit credential"
                        >
                          <Pencil aria-hidden />
                          <span className="sr-only">Edit credential</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(row)}
                          title="Delete credential"
                        >
                          <Trash2 aria-hidden />
                          <span className="sr-only">Delete credential</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </SectionShell>
      )}

      <CredentialDialog
        key={editing?.id ?? "new-credential"}
        clientId={clientId}
        credential={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={async () => {
          setDialogOpen(false)
          await load()
          onChanged()
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete credential?"
        description={`The ${deleting ? (CREDENTIAL_PORTAL_LABELS[deleting.portal as CredentialPortal] ?? deleting.portal) : ""} login for "${deleting?.username ?? ""}" will be removed from the vault. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

function CredentialDialog({
  clientId,
  credential,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string
  credential: CredentialRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setFieldErrors({})
    try {
      const result = await upsertCredential({
        clientId,
        id: credential?.id,
        portal: (form.get("portal") as CredentialPortal) ?? "OTHER",
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? "") || undefined,
        loginUrl: String(form.get("loginUrl") ?? "") || undefined,
        notes: String(form.get("notes") ?? "") || undefined,
      })
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        return
      }
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(credential ? "Credential updated" : "Credential added to vault")
      await onSaved()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{credential ? "Edit credential" : "Add credential"}</DialogTitle>
          <DialogDescription>
            Stored encrypted with AES-256-GCM. Only partners and managers can reveal
            passwords, and every reveal is logged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Portal" name="portal" required error={fieldErrors.portal?.[0]}>
              <select
                id="portal"
                name="portal"
                defaultValue={credential?.portal ?? "GST"}
                disabled={pending}
                className={selectClass}
              >
                {CREDENTIAL_PORTALS.map((portal) => (
                  <option key={portal} value={portal}>
                    {CREDENTIAL_PORTAL_LABELS[portal]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Username" name="username" required error={fieldErrors.username?.[0]}>
              <Input
                id="username"
                name="username"
                defaultValue={credential?.username ?? ""}
                className={cn(inputClass, "font-mono text-sm")}
                autoComplete="off"
                required
                disabled={pending}
              />
            </Field>
          </div>

          <Field
            label={credential ? "Password (leave blank to keep current)" : "Password"}
            name="password"
            required={!credential}
            error={fieldErrors.password?.[0]}
          >
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className={cn(inputClass, "pr-10 font-mono text-sm")}
                autoComplete="new-password"
                required={!credential}
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Field label="Login URL" name="loginUrl" error={fieldErrors.loginUrl?.[0]}>
            <Input
              id="loginUrl"
              name="loginUrl"
              type="url"
              placeholder="https://…"
              defaultValue={credential?.loginUrl ?? ""}
              className={inputClass}
              disabled={pending}
            />
          </Field>

          <Field label="Notes" name="notes" error={fieldErrors.notes?.[0]}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={credential?.notes ?? ""}
              className="input-premium min-h-[72px] rounded-xl"
              disabled={pending}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="btn-glow rounded-xl">
              {pending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Saving…
                </>
              ) : credential ? (
                "Save changes"
              ) : (
                "Add credential"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Statutory registrations ─────────────────────────────────────────────────

function RegistrationsSection({
  clientId,
  canManage,
  onChanged,
}: {
  clientId: string
  canManage: boolean
  onChanged: () => void
}) {
  const [rows, setRows] = useState<RegistrationRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<RegistrationRow | null>(null)
  const [deleting, setDeleting] = useState<RegistrationRow | null>(null)

  const load = useCallback(async () => {
    const result = await listClientRegistrations(clientId)
    if (result.error) setLoadError(result.error)
    else {
      setRows(result.registrations ?? [])
      setLoadError(null)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async () => {
    if (!deleting) return
    const result = await deleteRegistration(deleting.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Registration deleted")
    setDeleting(null)
    await load()
    onChanged()
  }

  if (loadError) return <SectionError message={loadError} />

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="btn-glow rounded-xl"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus aria-hidden />
            Add registration
          </Button>
        </div>
      )}

      {rows === null ? (
        <SectionLoading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No registrations recorded"
          description="Track this client's statutory registrations (GST, IEC, MSME, FSSAI…) with numbers, jurisdictions, and renewal dates."
          action={
            canManage
              ? {
                  label: "Add registration",
                  onClick: () => {
                    setEditing(null)
                    setDialogOpen(true)
                  },
                }
              : undefined
          }
        />
      ) : (
        <SectionShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Jurisdiction</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {REGISTRATION_TYPE_LABELS[row.registrationType as RegistrationType] ??
                      row.registrationType}
                  </TableCell>
                  <TableCell className="font-mono text-[13px]">
                    {row.registrationNumber}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.jurisdiction || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.issueDate)}
                  </TableCell>
                  <TableCell className={expiryTone(row.expiryDate)}>
                    {formatDate(row.expiryDate)}
                  </TableCell>
                  <TableCell>
                    <RegisterStatusBadge
                      status={row.status}
                      label={REGISTRATION_STATUS_LABELS[row.status as RegistrationStatus]}
                    />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(row)
                            setDialogOpen(true)
                          }}
                          title="Edit registration"
                        >
                          <Pencil aria-hidden />
                          <span className="sr-only">Edit registration</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(row)}
                          title="Delete registration"
                        >
                          <Trash2 aria-hidden />
                          <span className="sr-only">Delete registration</span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionShell>
      )}

      {canManage && (
        <>
          <RegistrationDialog
            key={editing?.id ?? "new-registration"}
            clientId={clientId}
            registration={editing}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSaved={async () => {
              setDialogOpen(false)
              await load()
              onChanged()
            }}
          />
          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(open) => !open && setDeleting(null)}
            title="Delete registration?"
            description={`Registration ${deleting?.registrationNumber ?? ""} will be removed from the register. This cannot be undone.`}
            confirmLabel="Delete"
            destructive
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  )
}

function RegistrationDialog({
  clientId,
  registration,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string
  registration: RegistrationRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setFieldErrors({})
    try {
      const result = await upsertRegistration({
        clientId,
        id: registration?.id,
        registrationType: (form.get("registrationType") as RegistrationType) ?? "OTHER",
        registrationNumber: String(form.get("registrationNumber") ?? ""),
        jurisdiction: String(form.get("jurisdiction") ?? "") || undefined,
        issueDate: String(form.get("issueDate") ?? "") || undefined,
        expiryDate: String(form.get("expiryDate") ?? "") || undefined,
        reminderDays: Number(form.get("reminderDays") ?? 30),
        status: (form.get("status") as RegistrationStatus) ?? "ACTIVE",
        notes: String(form.get("notes") ?? "") || undefined,
      })
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        return
      }
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(registration ? "Registration updated" : "Registration added")
      await onSaved()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {registration ? "Edit registration" : "Add registration"}
          </DialogTitle>
          <DialogDescription>
            Statutory registration details drive renewal reminders and the firm-wide
            register.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Type"
              name="registrationType"
              required
              error={fieldErrors.registrationType?.[0]}
            >
              <select
                id="registrationType"
                name="registrationType"
                defaultValue={registration?.registrationType ?? "GST"}
                disabled={pending}
                className={selectClass}
              >
                {REGISTRATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {REGISTRATION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Registration number"
              name="registrationNumber"
              required
              error={fieldErrors.registrationNumber?.[0]}
            >
              <Input
                id="registrationNumber"
                name="registrationNumber"
                defaultValue={registration?.registrationNumber ?? ""}
                className={cn(inputClass, "font-mono text-sm uppercase")}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Jurisdiction" name="jurisdiction" error={fieldErrors.jurisdiction?.[0]}>
              <Input
                id="jurisdiction"
                name="jurisdiction"
                placeholder="e.g. Karnataka"
                defaultValue={registration?.jurisdiction ?? ""}
                className={inputClass}
                disabled={pending}
              />
            </Field>
            <Field label="Status" name="status" error={fieldErrors.status?.[0]}>
              <select
                id="status"
                name="status"
                defaultValue={registration?.status ?? "ACTIVE"}
                disabled={pending}
                className={selectClass}
              >
                {REGISTRATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {REGISTRATION_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Issue date" name="issueDate" error={fieldErrors.issueDate?.[0]}>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                defaultValue={toDateInput(registration?.issueDate)}
                className={inputClass}
                disabled={pending}
              />
            </Field>
            <Field label="Expiry date" name="expiryDate" error={fieldErrors.expiryDate?.[0]}>
              <Input
                id="expiryDate"
                name="expiryDate"
                type="date"
                defaultValue={toDateInput(registration?.expiryDate)}
                className={inputClass}
                disabled={pending}
              />
            </Field>
            <Field
              label="Reminder (days before expiry)"
              name="reminderDays"
              error={fieldErrors.reminderDays?.[0]}
            >
              <Input
                id="reminderDays"
                name="reminderDays"
                type="number"
                min={0}
                max={365}
                defaultValue={registration?.reminderDays ?? 30}
                className={inputClass}
                disabled={pending}
              />
            </Field>
          </div>

          <Field label="Notes" name="notes" error={fieldErrors.notes?.[0]}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={registration?.notes ?? ""}
              className="input-premium min-h-[72px] rounded-xl"
              disabled={pending}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="btn-glow rounded-xl">
              {pending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Saving…
                </>
              ) : registration ? (
                "Save changes"
              ) : (
                "Add registration"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── DSC register ────────────────────────────────────────────────────────────

function DscSection({
  clientId,
  canManage,
  onChanged,
}: {
  clientId: string
  canManage: boolean
  onChanged: () => void
}) {
  const [rows, setRows] = useState<DscRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DscRow | null>(null)
  const [deleting, setDeleting] = useState<DscRow | null>(null)

  const load = useCallback(async () => {
    const result = await listClientDscRecords(clientId)
    if (result.error) setLoadError(result.error)
    else {
      setRows(result.dscs ?? [])
      setLoadError(null)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async () => {
    if (!deleting) return
    const result = await deleteDscRecord(deleting.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("DSC record deleted")
    setDeleting(null)
    await load()
    onChanged()
  }

  if (loadError) return <SectionError message={loadError} />

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="btn-glow rounded-xl"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus aria-hidden />
            Add DSC
          </Button>
        </div>
      )}

      {rows === null ? (
        <SectionLoading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Fingerprint}
          title="No DSCs recorded"
          description="Track digital signature certificates — holder, expiry, and who has custody of the token — so renewals never lapse."
          action={
            canManage
              ? {
                  label: "Add DSC",
                  onClick: () => {
                    setEditing(null)
                    setDialogOpen(true)
                  },
                }
              : undefined
          }
        />
      ) : (
        <SectionShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Holder</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Serial no.</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Custody</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.holderName}</TableCell>
                  <TableCell>
                    {DSC_CLASS_LABELS[row.dscClass as DscClass] ?? row.dscClass}
                  </TableCell>
                  <TableCell className="font-mono text-[13px] text-muted-foreground">
                    {row.serialNumber || "—"}
                  </TableCell>
                  <TableCell className={expiryTone(row.expiryDate)}>
                    {formatDate(row.expiryDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.custody || "—"}
                  </TableCell>
                  <TableCell>
                    <RegisterStatusBadge
                      status={row.status}
                      label={DSC_STATUS_LABELS[row.status as DscStatus]}
                    />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setEditing(row)
                            setDialogOpen(true)
                          }}
                          title="Edit DSC"
                        >
                          <Pencil aria-hidden />
                          <span className="sr-only">Edit DSC</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(row)}
                          title="Delete DSC"
                        >
                          <Trash2 aria-hidden />
                          <span className="sr-only">Delete DSC</span>
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionShell>
      )}

      {canManage && (
        <>
          <DscDialog
            key={editing?.id ?? "new-dsc"}
            clientId={clientId}
            dsc={editing}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSaved={async () => {
              setDialogOpen(false)
              await load()
              onChanged()
            }}
          />
          <ConfirmDialog
            open={deleting !== null}
            onOpenChange={(open) => !open && setDeleting(null)}
            title="Delete DSC record?"
            description={`The DSC for "${deleting?.holderName ?? ""}" will be removed from the register. This cannot be undone.`}
            confirmLabel="Delete"
            destructive
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  )
}

function DscDialog({
  clientId,
  dsc,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string
  dsc: DscRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setFieldErrors({})
    try {
      const result = await upsertDscRecord({
        clientId,
        id: dsc?.id,
        holderName: String(form.get("holderName") ?? ""),
        dscClass: (form.get("dscClass") as DscClass) ?? "CLASS_3",
        serialNumber: String(form.get("serialNumber") ?? "") || undefined,
        issuedBy: String(form.get("issuedBy") ?? "") || undefined,
        issueDate: String(form.get("issueDate") ?? "") || undefined,
        expiryDate: String(form.get("expiryDate") ?? ""),
        custody: String(form.get("custody") ?? "") || undefined,
        status: (form.get("status") as DscStatus) ?? "ACTIVE",
        notes: String(form.get("notes") ?? "") || undefined,
      })
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        return
      }
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(dsc ? "DSC record updated" : "DSC added to register")
      await onSaved()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dsc ? "Edit DSC record" : "Add DSC record"}</DialogTitle>
          <DialogDescription>
            Track the certificate holder, validity, and physical custody of the token.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Holder name"
              name="holderName"
              required
              error={fieldErrors.holderName?.[0]}
              className="sm:col-span-2"
            >
              <Input
                id="holderName"
                name="holderName"
                placeholder="Director / partner name"
                defaultValue={dsc?.holderName ?? ""}
                className={inputClass}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Class" name="dscClass" error={fieldErrors.dscClass?.[0]}>
              <select
                id="dscClass"
                name="dscClass"
                defaultValue={dsc?.dscClass ?? "CLASS_3"}
                disabled={pending}
                className={selectClass}
              >
                {DSC_CLASSES.map((dscClass) => (
                  <option key={dscClass} value={dscClass}>
                    {DSC_CLASS_LABELS[dscClass]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Serial number" name="serialNumber" error={fieldErrors.serialNumber?.[0]}>
              <Input
                id="serialNumber"
                name="serialNumber"
                defaultValue={dsc?.serialNumber ?? ""}
                className={cn(inputClass, "font-mono text-sm")}
                disabled={pending}
              />
            </Field>
            <Field label="Issued by" name="issuedBy" error={fieldErrors.issuedBy?.[0]}>
              <Input
                id="issuedBy"
                name="issuedBy"
                placeholder="e.g. eMudhra"
                defaultValue={dsc?.issuedBy ?? ""}
                className={inputClass}
                disabled={pending}
              />
            </Field>
            <Field label="Custody" name="custody" error={fieldErrors.custody?.[0]}>
              <Input
                id="custody"
                name="custody"
                placeholder="Who holds the token"
                defaultValue={dsc?.custody ?? ""}
                className={inputClass}
                disabled={pending}
              />
            </Field>
            <Field label="Issue date" name="issueDate" error={fieldErrors.issueDate?.[0]}>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                defaultValue={toDateInput(dsc?.issueDate)}
                className={inputClass}
                disabled={pending}
              />
            </Field>
            <Field
              label="Expiry date"
              name="expiryDate"
              required
              error={fieldErrors.expiryDate?.[0]}
            >
              <Input
                id="expiryDate"
                name="expiryDate"
                type="date"
                defaultValue={toDateInput(dsc?.expiryDate)}
                className={inputClass}
                required
                disabled={pending}
              />
            </Field>
            <Field label="Status" name="status" error={fieldErrors.status?.[0]}>
              <select
                id="status"
                name="status"
                defaultValue={dsc?.status ?? "ACTIVE"}
                disabled={pending}
                className={selectClass}
              >
                {DSC_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {DSC_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes" name="notes" error={fieldErrors.notes?.[0]}>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={dsc?.notes ?? ""}
              className="input-premium min-h-[72px] rounded-xl"
              disabled={pending}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="btn-glow rounded-xl">
              {pending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Saving…
                </>
              ) : dsc ? (
                "Save changes"
              ) : (
                "Add DSC"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── UDIN register ───────────────────────────────────────────────────────────

function UdinSection({
  clientId,
  canManage,
  onChanged,
}: {
  clientId: string
  canManage: boolean
  onChanged: () => void
}) {
  const [rows, setRows] = useState<UdinRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const load = useCallback(async () => {
    const result = await listClientUdinRecords(clientId)
    if (result.error) setLoadError(result.error)
    else {
      setRows(result.udins ?? [])
      setLoadError(null)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  if (loadError) return <SectionError message={loadError} />

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" className="btn-glow rounded-xl" onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden />
            Record UDIN
          </Button>
        </div>
      )}

      {rows === null ? (
        <SectionLoading />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="No UDINs recorded"
          description="Maintain the UDIN register for certificates and reports signed for this client."
          action={
            canManage
              ? { label: "Record UDIN", onClick: () => setDialogOpen(true) }
              : undefined
          }
        />
      ) : (
        <SectionShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UDIN</TableHead>
                <TableHead>Document type</TableHead>
                <TableHead>Document date</TableHead>
                <TableHead>Generated by</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-[13px]">{row.udin}</TableCell>
                  <TableCell>{row.documentType}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.documentDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.generatedBy || "—"}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-muted-foreground">
                    {row.remarks || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionShell>
      )}

      {canManage && (
        <UdinDialog
          clientId={clientId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSaved={async () => {
            setDialogOpen(false)
            await load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function UdinDialog({
  clientId,
  open,
  onOpenChange,
  onSaved,
}: {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    setPending(true)
    setFieldErrors({})
    try {
      const result = await createUdinRecord({
        clientId,
        udin: String(form.get("udin") ?? ""),
        documentType: String(form.get("documentType") ?? ""),
        documentDate: String(form.get("documentDate") ?? ""),
        generatedBy: String(form.get("generatedBy") ?? "") || undefined,
        remarks: String(form.get("remarks") ?? "") || undefined,
      })
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors)
        return
      }
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("UDIN recorded")
      await onSaved()
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record UDIN</DialogTitle>
          <DialogDescription>
            Log the Unique Document Identification Number generated on the ICAI portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="UDIN" name="udin" required error={fieldErrors.udin?.[0]}>
            <Input
              id="udin"
              name="udin"
              placeholder="15-18 letters/digits"
              maxLength={18}
              className={cn(inputClass, "font-mono text-sm uppercase")}
              autoComplete="off"
              required
              disabled={pending}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Document type"
              name="documentType"
              required
              error={fieldErrors.documentType?.[0]}
            >
              <Input
                id="documentType"
                name="documentType"
                placeholder="e.g. Tax Audit Report"
                className={inputClass}
                required
                disabled={pending}
              />
            </Field>
            <Field
              label="Document date"
              name="documentDate"
              required
              error={fieldErrors.documentDate?.[0]}
            >
              <Input
                id="documentDate"
                name="documentDate"
                type="date"
                className={inputClass}
                required
                disabled={pending}
              />
            </Field>
          </div>

          <Field label="Generated by" name="generatedBy" error={fieldErrors.generatedBy?.[0]}>
            <Input
              id="generatedBy"
              name="generatedBy"
              placeholder="Signing partner / membership no."
              className={inputClass}
              disabled={pending}
            />
          </Field>

          <Field label="Remarks" name="remarks" error={fieldErrors.remarks?.[0]}>
            <Textarea
              id="remarks"
              name="remarks"
              className="input-premium min-h-[72px] rounded-xl"
              disabled={pending}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="btn-glow rounded-xl">
              {pending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Record UDIN"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
