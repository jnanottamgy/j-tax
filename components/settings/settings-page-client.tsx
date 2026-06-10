"use client"

import { useActionState, useState } from "react"
import { Loader2, Building2, Mail } from "lucide-react"
import { User, Bell, Shield, CreditCard } from "lucide-react"

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
  type NotificationPrefs,
  type FirmSettingsActionState,
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
    const result = await saveNotificationPreferences(notifications)
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

              <div className="flex justify-end">
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
              <Label htmlFor="sms-notifications">SMS Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive urgent alerts via SMS</p>
            </div>
            <Switch
              id="sms-notifications"
              checked={notifications.sms}
              onCheckedChange={(checked) => setNotifications({ ...notifications, sms: checked })}
            />
          </div>
          <Separator className="bg-white/[0.06]" />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">Push Notifications</Label>
              <p className="text-xs text-muted-foreground">Receive in-app notifications</p>
            </div>
            <Switch
              id="push-notifications"
              checked={notifications.push}
              onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
            />
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

      {/* ── Billing (placeholder) ─────────────────────────────────────────── */}
      {userRole === "PARTNER" && (
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing &amp; Subscription
            </CardTitle>
            <CardDescription>Manage your subscription and payment methods</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <div>
                <p className="font-medium">Professional Plan</p>
                <p className="text-sm text-muted-foreground">Contact your administrator to manage billing.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
