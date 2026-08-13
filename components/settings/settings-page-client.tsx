"use client"

import { useActionState, useEffect, useState } from "react"
import { Loader2, Building2, Mail, Globe, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Copy } from "lucide-react"
import { User, Bell, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  saveProfile,
  changePassword,
  saveNotificationPreferences,
  saveFirmSettings,
  getDomainVerificationStatus,
  checkAndActivateDomainVerification,
  getEmailDeliveryDiagnostics,
  sendTestEmail,
  type NotificationPrefs,
  type FirmSettingsActionState,
  type DomainVerificationStatus,
  type EmailDiagnostics,
} from "@/app/actions/settings"
import type { FirmConfig } from "@/lib/firm-settings"
import { useAuth } from "@/components/auth/auth-provider"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { passwordSchema, profileSchema } from "@/lib/validations/settings"
import type { AppRole } from "@/lib/auth/types"

export function SettingsPageClient({
  initialNotificationPrefs,
  initialFirmSettings,
  userRole,
}: {
  initialNotificationPrefs?: NotificationPrefs
  initialFirmSettings?: FirmConfig
  userRole: AppRole
}) {
  const { user } = useAuth()

  // ── Profile ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? "")

  // ── Password ─────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // ── Notifications ─────────────────────────────────────────────────────────
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)
  const [notifError, setNotifError] = useState("")
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    email: initialNotificationPrefs?.email ?? true,
    sms: initialNotificationPrefs?.sms ?? false,
    push: initialNotificationPrefs?.push ?? true,
  })

  // ── Firm Settings (PARTNER only) ──────────────────────────────────────────
  const [firmState, firmAction, firmPending] = useActionState<FirmSettingsActionState, FormData>(
    saveFirmSettings,
    {}
  )

  // ── Domain Verification (PARTNER only, Phase 8) ───────────────────────────
  const [domainStatus, setDomainStatus] = useState<DomainVerificationStatus | null>(null)
  const [domainLoading, setDomainLoading] = useState(false)
  const [domainBusy, setDomainBusy] = useState(false)
  const [domainResult, setDomainResult] = useState<string>("")
  const [domainResultKind, setDomainResultKind] = useState<"ok" | "warn" | "err" | "">("")

  // ── Email delivery diagnostics (PARTNER only) ─────────────────────────────
  const [diagnostics, setDiagnostics] = useState<EmailDiagnostics | null>(null)
  const [diagLoading, setDiagLoading] = useState(false)
  const [testTo, setTestTo] = useState("")
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState("")
  const [testOk, setTestOk] = useState(false)
  const [copied, setCopied] = useState<string>("")

  useEffect(() => {
    if (userRole !== "PARTNER") return
    let cancelled = false
    setDomainLoading(true)
    getDomainVerificationStatus()
      .then((s) => { if (!cancelled) setDomainStatus(s) })
      .catch(() => { /* token will be issued on first save */ })
      .finally(() => { if (!cancelled) setDomainLoading(false) })
    return () => { cancelled = true }
  }, [userRole, firmState.success])

  // Re-read after a settings save — the sender address may have changed.
  useEffect(() => {
    if (userRole !== "PARTNER") return
    let cancelled = false
    setDiagLoading(true)
    getEmailDeliveryDiagnostics()
      .then((d) => { if (!cancelled) setDiagnostics(d) })
      .catch(() => { /* card renders its own fallback */ })
      .finally(() => { if (!cancelled) setDiagLoading(false) })
    return () => { cancelled = true }
  }, [userRole, firmState.success])

  const handleTestEmail = async () => {
    setTestBusy(true)
    setTestResult("")
    try {
      const r = await sendTestEmail(testTo)
      setTestOk(r.success)
      setTestResult(r.message)
      // A send exercises the real provider, so refresh the checks with it.
      setDiagnostics(await getEmailDeliveryDiagnostics())
    } catch (err) {
      setTestOk(false)
      setTestResult(err instanceof Error ? err.message : "Test send failed.")
    } finally {
      setTestBusy(false)
    }
  }

  const handleVerify = async () => {
    setDomainBusy(true)
    setDomainResult("")
    setDomainResultKind("")
    try {
      const r = await checkAndActivateDomainVerification()
      if (r.verified) {
        setDomainResult(r.message)
        setDomainResultKind("ok")
      } else if (r.success) {
        setDomainResult(r.message)
        setDomainResultKind("warn")
      } else {
        setDomainResult(r.message)
        setDomainResultKind("err")
      }
      // Refresh status
      const s = await getDomainVerificationStatus()
      setDomainStatus(s)
    } finally {
      setDomainBusy(false)
    }
  }

  const copyValue = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val)
      setCopied(key)
      setTimeout(() => setCopied(""), 2000)
    } catch {}
  }

  const profileForm = useValidatedForm({
    schema: profileSchema,
    successMessage: "Profile saved successfully",
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("name", data.name)
      return saveProfile({}, fd)
    },
  })

  const passwordForm = useValidatedForm({
    schema: passwordSchema,
    successMessage: "Password changed successfully",
    onSuccess: () => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    },
    onSubmit: async (data) => {
      const fd = new FormData()
      fd.set("currentPassword", data.currentPassword)
      fd.set("newPassword", data.newPassword)
      fd.set("confirmPassword", data.confirmPassword)
      return changePassword({}, fd)
    },
  })

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    profileForm.submit({ name })
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    passwordForm.submit({ currentPassword, newPassword, confirmPassword })
  }

  const handleSaveNotifications = async () => {
    setNotifSaving(true)
    setNotifSaved(false)
    setNotifError("")
    // SMS delivery isn't wired yet — never persist it as enabled.
    const result = await saveNotificationPreferences({ ...notifications, sms: false })
    setNotifSaving(false)
    if (result.error) {
      setNotifError(result.error)
    } else {
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 3000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your workspace preferences, integrations, and security controls.
        </p>
      </div>

      {/* ── Firm Details — PARTNER only ─────────────────────────────────── */}
      {userRole === "PARTNER" && (
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Firm Details
            </CardTitle>
            <CardDescription>
              Configure your firm&apos;s name, sender email, and contact details. These values
              appear in all outbound emails and PDF quotations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={firmAction} className="space-y-4">
              {firmState.error && <FormAlert message={firmState.error} />}
              {firmState.success && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  Firm settings saved successfully.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firmName">
                    Firm Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="firmName"
                    name="firmName"
                    defaultValue={initialFirmSettings?.firmName ?? ""}
                    placeholder="e.g. Sharma & Associates"
                    className="input-premium h-10 rounded-xl"
                    required
                  />
                  {firmState.fieldErrors?.firmName && (
                    <p className="text-xs text-destructive">{firmState.fieldErrors.firmName[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromEmail">
                    Sender Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="fromEmail"
                    name="fromEmail"
                    type="email"
                    defaultValue={initialFirmSettings?.fromEmail ?? ""}
                    placeholder="noreply@yourfirm.com"
                    className="input-premium h-10 rounded-xl"
                    required
                  />
                  {firmState.fieldErrors?.fromEmail && (
                    <p className="text-xs text-destructive">{firmState.fieldErrors.fromEmail[0]}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Must be verified in your Resend dashboard.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="replyToEmail">Reply-To Email</Label>
                  <Input
                    id="replyToEmail"
                    name="replyToEmail"
                    type="email"
                    defaultValue={initialFirmSettings?.replyToEmail ?? ""}
                    placeholder="contact@yourfirm.com"
                    className="input-premium h-10 rounded-xl"
                  />
                  {firmState.fieldErrors?.replyToEmail && (
                    <p className="text-xs text-destructive">{firmState.fieldErrors.replyToEmail[0]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmPhone">Phone Number</Label>
                  <Input
                    id="firmPhone"
                    name="firmPhone"
                    defaultValue={initialFirmSettings?.firmPhone ?? ""}
                    placeholder="+91 98765 43210"
                    className="input-premium h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    name="gstin"
                    defaultValue={initialFirmSettings?.gstin ?? ""}
                    placeholder="22AAAAA0000A1Z5"
                    className="input-premium h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input
                    id="pan"
                    name="pan"
                    defaultValue={initialFirmSettings?.pan ?? ""}
                    placeholder="AAAAA0000A"
                    className="input-premium h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    defaultValue={initialFirmSettings?.website ?? ""}
                    placeholder="https://yourfirm.com"
                    className="input-premium h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firmAddress">Office Address</Label>
                <Textarea
                  id="firmAddress"
                  name="firmAddress"
                  defaultValue={initialFirmSettings?.firmAddress ?? ""}
                  placeholder="123, Business Park, Mumbai — 400001"
                  className="input-premium rounded-xl resize-none"
                  rows={2}
                />
              </div>

              {/* ── Payment collection details ─────────────────────────── */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium">Payment collection details</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Shown to clients in the portal&apos;s “Pay” dialog and on invoice PDFs.
                    Leave blank to hide.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      name="bankName"
                      defaultValue={initialFirmSettings?.bankName ?? ""}
                      placeholder="HDFC Bank"
                      className="input-premium h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountName">Account Name</Label>
                    <Input
                      id="bankAccountName"
                      name="bankAccountName"
                      defaultValue={initialFirmSettings?.bankAccountName ?? ""}
                      placeholder="Sharma & Associates"
                      className="input-premium h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                    <Input
                      id="bankAccountNumber"
                      name="bankAccountNumber"
                      defaultValue={initialFirmSettings?.bankAccountNumber ?? ""}
                      placeholder="50100123456789"
                      className="input-premium h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankIfsc">IFSC Code</Label>
                    <Input
                      id="bankIfsc"
                      name="bankIfsc"
                      defaultValue={initialFirmSettings?.bankIfsc ?? ""}
                      placeholder="HDFC0001234"
                      className="input-premium h-10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input
                      id="upiId"
                      name="upiId"
                      defaultValue={initialFirmSettings?.upiId ?? ""}
                      placeholder="yourfirm@okhdfcbank"
                      className="input-premium h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    name="platformFallbackEnabled"
                    defaultChecked={initialFirmSettings?.platformFallbackEnabled ?? true}
                    className="rounded border-white/20"
                  />
                  <span>
                    Send via platform fallback when domain isn&apos;t verified yet (recommended)
                  </span>
                </label>
                <Button
                  type="submit"
                  disabled={firmPending}
                  className="btn-glow h-10 rounded-xl"
                >
                  {firmPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Firm Details"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Email Delivery diagnostics (PARTNER only) ───────────────────── */}
      {userRole === "PARTNER" && (
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Delivery
            </CardTitle>
            <CardDescription>
              Whether outbound email can actually be delivered right now, and what is
              blocking it. Start here when an invite or reminder does not arrive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagLoading && !diagnostics ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : diagnostics ? (
              <>
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    diagnostics.canSend
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/20 bg-red-500/10 text-red-400"
                  }`}
                >
                  {diagnostics.canSend
                    ? "Email is configured and can be delivered."
                    : "Email cannot be delivered — see the blocking items below."}
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-1 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Sends as</span>
                    <code className="text-right font-mono text-xs break-all">
                      {diagnostics.effectiveFrom}
                    </code>
                  </div>
                  {diagnostics.replyTo && (
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">Replies go to</span>
                      <code className="text-right font-mono text-xs break-all">
                        {diagnostics.replyTo}
                      </code>
                    </div>
                  )}
                </div>

                <ul className="space-y-2">
                  {diagnostics.checks.map((c) => (
                    <li key={c.label} className="flex items-start gap-2 text-sm">
                      {c.ok ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertTriangle
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            c.blocking ? "text-red-400" : "text-amber-400"
                          }`}
                        />
                      )}
                      <span>
                        <span className="font-medium">{c.label}</span>
                        {!c.ok && c.blocking && (
                          <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                            blocking
                          </span>
                        )}
                        <span className="block text-xs text-muted-foreground">{c.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <Separator className="bg-white/[0.06]" />

                <div className="space-y-2">
                  <Label htmlFor="testEmail">Send a test email</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="testEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestEmail}
                      disabled={testBusy}
                      className="shrink-0"
                    >
                      {testBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}
                      Send test
                    </Button>
                  </div>
                  {testResult && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        testOk
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : "border-red-500/20 bg-red-500/10 text-red-400"
                      }`}
                    >
                      {testResult}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Could not read email configuration.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Domain Verification (PARTNER only) ──────────────────────────── */}
      {userRole === "PARTNER" && (
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Email Domain Verification
              {domainStatus?.verified && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              )}
              {domainStatus && !domainStatus.verified && domainStatus.usingFallback && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> Using platform fallback
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Publish three DNS records at your domain registrar so emails are sent
              directly from your firm&apos;s domain. While unverified, emails go out
              with your firm&apos;s branding via the platform domain and Reply-To
              still routes back to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {domainLoading && (
              <div className="text-sm text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                Checking domain status…
              </div>
            )}

            {!domainLoading && !domainStatus?.domain && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                Configure your Sender Email above first — the domain is extracted
                from it automatically.
              </div>
            )}

            {!domainLoading && domainStatus?.domain && (
              <>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">Detected domain:</span>{" "}
                    <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-foreground">
                      {domainStatus.domain}
                    </code>
                  </p>
                  {domainStatus.verified && domainStatus.verifiedAt && (
                    <p className="mt-1 text-xs text-emerald-400">
                      Verified on {new Date(domainStatus.verifiedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-white/[0.03]">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Host</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Value</th>
                        <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domainStatus.records.map((r) => {
                        // Per-record state comes from Resend itself — it is the
                        // only party that can validate these records.
                        const recordVerified = r.status === "verified"
                        return (
                          <tr key={`${r.type}-${r.host}`} className="border-t border-white/[0.06]">
                            <td className="px-3 py-2 align-top">
                              <span className="rounded bg-white/[0.06] px-1.5 py-0.5">{r.type}</span>
                              {r.priority !== undefined && (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  priority {r.priority}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top font-mono">
                              <button
                                type="button"
                                onClick={() => copyValue(`host-${r.host}`, r.host)}
                                className="inline-flex items-center gap-1 hover:text-foreground"
                                title="Copy"
                              >
                                {r.host}
                                <Copy className="h-3 w-3 opacity-50" />
                              </button>
                              {copied === `host-${r.host}` && (
                                <span className="ml-1 text-emerald-400 text-[10px]">copied</span>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top font-mono break-all">
                              <button
                                type="button"
                                onClick={() => copyValue(`val-${r.host}`, r.value)}
                                className="inline-flex items-start gap-1 text-left hover:text-foreground"
                                title="Copy"
                              >
                                <span>{r.value}</span>
                                <Copy className="h-3 w-3 opacity-50 flex-shrink-0 mt-0.5" />
                              </button>
                              {copied === `val-${r.host}` && (
                                <span className="ml-1 text-emerald-400 text-[10px]">copied</span>
                              )}
                              <p className="mt-1 text-[11px] text-muted-foreground italic">{r.purpose}</p>
                            </td>
                            <td className="px-3 py-2 align-top text-center">
                              {recordVerified ? (
                                <CheckCircle2 className="inline h-4 w-4 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="inline h-4 w-4 text-amber-400" />
                              )}
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {r.status
                                  ? recordVerified
                                    ? "Verified"
                                    : `Provider status: ${r.status}`
                                  : "Awaiting provider check"}
                              </p>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {domainResult && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${
                    domainResultKind === "ok"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : domainResultKind === "warn"
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                      : "border-red-500/20 bg-red-500/10 text-red-400"
                  }`}>
                    {domainResult}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    DNS propagation can take up to 48 hours. Click <em>Verify</em> after publishing the records.
                  </p>
                  <Button
                    type="button"
                    onClick={handleVerify}
                    disabled={domainBusy}
                    variant="outline"
                    className="input-premium h-9 rounded-xl"
                  >
                    {domainBusy ? (
                      <><Loader2 className="size-4 animate-spin mr-2" /> Checking…</>
                    ) : (
                      <><RefreshCw className="size-4 mr-2" /> Verify Now</>
                    )}
                  </Button>
                </div>

                <p className="text-xs">
                  <a href="/docs/email-setup" className="text-blue-400 hover:underline">
                    Read the full Firm Email Setup Guide →
                  </a>
                </p>

                <details className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Need step-by-step instructions?</summary>
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <p><strong className="text-foreground">1. Log in to your DNS provider</strong> (GoDaddy, Cloudflare, Route 53, etc.).</p>
                    <p><strong className="text-foreground">2. Add each record above</strong> to the DNS zone for <code className="bg-white/[0.06] px-1 rounded">{domainStatus.domain}</code>. Most providers strip the domain suffix from the host — paste only the prefix (e.g. <code className="bg-white/[0.06] px-1 rounded">_jtacs-verify</code>, not the full FQDN).</p>
                    <p><strong className="text-foreground">3. Save the records.</strong></p>
                    <p><strong className="text-foreground">4. Click &ldquo;Verify Now&rdquo;</strong> once propagation completes. Until then, emails still go out with your firm&apos;s branding via the platform fallback.</p>
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Email Configuration (PARTNER read info; MANAGER/EMPLOYEE hidden) ── */}
      {userRole === "MANAGER" && initialFirmSettings?.firmName && (
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Configuration
            </CardTitle>
            <CardDescription>Current firm email settings (read-only for Managers)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">Firm Name:</span> {initialFirmSettings.firmName}</p>
            <p><span className="font-medium text-foreground">Sender Email:</span> {initialFirmSettings.fromEmail || "Not configured"}</p>
            {initialFirmSettings.firmPhone && (
              <p><span className="font-medium text-foreground">Phone:</span> {initialFirmSettings.firmPhone}</p>
            )}
            <p className="text-xs">Contact your Partner to update firm settings.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <Card className="border-white/[0.08] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Settings
          </CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
            {profileForm.formError && <FormAlert message={profileForm.formError} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Full Name" htmlFor="fullName" required error={profileForm.getError("name")}>
                <Input
                  id="fullName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="input-premium h-10 rounded-xl"
                  disabled={profileForm.isPending}
                  aria-invalid={!!profileForm.getError("name")}
                />
              </FormField>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="input-premium h-10 rounded-xl opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={profileForm.isPending || name.trim().length < 2}
                className="btn-glow h-10 rounded-xl"
              >
                {profileForm.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <Card className="border-white/[0.08] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Choose how you want to receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive updates via email</p>
            </div>
            <Switch
              id="email-notifications"
              checked={notifications.email}
              onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
            />
          </div>
          <Separator className="bg-white/[0.06]" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">In-App Notifications</Label>
              <p className="text-xs text-muted-foreground">Show alerts in the notification bell</p>
            </div>
            <Switch
              id="push-notifications"
              checked={notifications.push}
              onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
            />
          </div>
          <Separator className="bg-white/[0.06]" />
          <div className="flex items-center justify-between opacity-60">
            <div className="space-y-0.5">
              <Label htmlFor="sms-notifications" className="flex items-center gap-2">
                SMS Notifications
                <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Coming soon
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Urgent alerts via SMS — requires an SMS provider (not yet configured)
              </p>
            </div>
            <Switch id="sms-notifications" checked={false} disabled aria-label="SMS notifications (coming soon)" />
          </div>
          {notifError && <p className="text-sm text-destructive">{notifError}</p>}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveNotifications}
              disabled={notifSaving}
              variant="outline"
              className="input-premium h-10 rounded-xl"
            >
              {notifSaving ? (
                <><Loader2 className="size-4 animate-spin mr-2" />Saving...</>
              ) : notifSaved ? (
                "Saved ✓"
              ) : (
                "Save Preferences"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <Card className="border-white/[0.08] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
            {passwordForm.formError && <FormAlert message={passwordForm.formError} />}
            <FormField
              label="Current Password"
              htmlFor="current-password"
              required
              error={passwordForm.getError("currentPassword")}
            >
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-premium h-10 rounded-xl"
                disabled={passwordForm.isPending}
                aria-invalid={!!passwordForm.getError("currentPassword")}
              />
            </FormField>
            <FormField
              label="New Password"
              htmlFor="new-password"
              required
              error={passwordForm.getError("newPassword")}
            >
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-premium h-10 rounded-xl"
                disabled={passwordForm.isPending}
                aria-invalid={!!passwordForm.getError("newPassword")}
              />
            </FormField>
            <FormField
              label="Confirm New Password"
              htmlFor="confirm-password"
              required
              error={passwordForm.getError("confirmPassword")}
            >
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-premium h-10 rounded-xl"
                disabled={passwordForm.isPending}
                aria-invalid={!!passwordForm.getError("confirmPassword")}
              />
            </FormField>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  passwordForm.isPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                variant="outline"
                className="input-premium h-10 rounded-xl"
              >
                {passwordForm.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Changing...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

    </div>
  )
}
