"use client"

/**
 * Client portal access, on the client record.
 *
 * The portal shipped as six finished pages with no way to let anyone into it —
 * the only route was hand-creating a Supabase user whose email happened to
 * match the client's. This is the switch that was missing.
 */

import { useEffect, useState, useTransition } from "react"
import { format } from "date-fns"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  getClientPortalAccess,
  inviteClientToPortal,
  revokeClientPortalAccess,
  type PortalAccessState,
} from "@/app/actions/client-portal-access"

export function PortalAccessCard({
  clientId,
  canManage,
}: {
  clientId: string
  canManage: boolean
}) {
  const [state, setState] = useState<PortalAccessState | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getClientPortalAccess(clientId)
      .then((r) => { if (!cancelled && r) setState(r) })
      .catch(() => { /* card shows its own fallback */ })
    return () => { cancelled = true }
  }, [clientId])

  if (!state) return null

  function handleInvite() {
    setError("")
    startTransition(async () => {
      const result = await inviteClientToPortal(clientId)
      if (!result.success || !result.state) {
        setError(result.error ?? "Could not grant portal access.")
        return
      }
      setState(result.state)
    })
  }

  function handleRevoke() {
    setError("")
    startTransition(async () => {
      const result = await revokeClientPortalAccess(clientId)
      if (!result.success) {
        setError(result.error ?? "Could not revoke portal access.")
        return
      }
      setState({ ...state!, enabled: false, invitedAt: null, tempPassword: null })
      setConfirmingRevoke(false)
    })
  }

  async function copyPassword() {
    if (!state?.tempPassword) return
    await navigator.clipboard.writeText(state.tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${
              state.enabled
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-white/[0.1] bg-white/[0.03] text-muted-foreground"
            }`}
          >
            <ShieldCheck className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Client portal</p>
            {state.enabled ? (
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {state.email} can sign in to see their deadlines, filing status and
                invoices.
                {state.lastSeenAt
                  ? ` Last opened ${format(new Date(state.lastSeenAt), "d MMM yyyy")}.`
                  : state.invitedAt
                    ? ` Invited ${format(new Date(state.invitedAt), "d MMM yyyy")} — not signed in yet.`
                    : ""}
              </p>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {state.email
                  ? `Give ${state.email} a login to see their own deadlines, filing status and invoices — it cuts the "what's the status?" calls.`
                  : "Add an email address to this client before inviting them to the portal."}
              </p>
            )}
            {error && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>

        {canManage && (
          <div className="shrink-0">
            {state.enabled ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmingRevoke(true)}
                disabled={pending}
                className="gap-2"
              >
                <UserRoundX className="size-3.5" />
                Revoke access
              </Button>
            ) : (
              <Button onClick={handleInvite} disabled={pending || !state.email} size="sm" className="gap-2">
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserRoundCheck className="size-3.5" />
                )}
                Invite to portal
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Credentials fallback. Shown once, right after provisioning — a firm
          whose sender domain isn't verified yet would otherwise have no way to
          get the password to the client. */}
      {state.tempPassword && (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm">
            {state.emailSent ? (
              <>
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span className="text-muted-foreground">
                  Invite emailed to {state.email}.
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="size-4 shrink-0 text-amber-400" />
                <span className="text-muted-foreground">
                  The invite email didn&apos;t send — pass these on yourself.
                </span>
              </>
            )}
          </div>
          {state.emailError && (
            <p className="mt-2 text-xs text-amber-400/90">{state.emailError}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/20 px-3 py-2 font-mono text-xs">
              {state.tempPassword}
            </code>
            <Button variant="outline" size="sm" onClick={copyPassword} className="gap-1.5">
              <Copy className="size-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            One-time password. They&apos;ll choose their own on first sign-in, and this
            won&apos;t be shown again.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmingRevoke}
        onOpenChange={setConfirmingRevoke}
        title="Revoke portal access?"
        description={`${state.email} will be signed out and blocked from the portal. You can invite them again at any time.`}
        confirmLabel="Revoke access"
        destructive
        onConfirm={handleRevoke}
      />
    </div>
  )
}
