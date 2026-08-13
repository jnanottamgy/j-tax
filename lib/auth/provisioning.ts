import { randomBytes } from "crypto"
import { createClient } from "@supabase/supabase-js"

import { getFirmSettings } from "@/lib/firm-settings"
import { resendProvider } from "@/lib/messaging/resend-provider"
import { prisma } from "@/lib/prisma"
import { getSupabaseUrl } from "@/lib/supabase/env"

/**
 * Staff account provisioning.
 *
 * When a PARTNER/MANAGER adds a team member, we create a real Supabase auth
 * user (role in user_metadata — that is what `mapSupabaseUser` reads at login),
 * mirror it into the Prisma `User` table (Prisma User.id === Supabase auth id,
 * same convention as onboarding.ts), and get credentials to the new hire two
 * ways: an invite email via Resend, plus a one-time temp password shown to the
 * creator as a fallback when email delivery isn't configured/working.
 */

export type StaffRole = "EMPLOYEE" | "MANAGER"

let _adminClient: ReturnType<typeof createClient> | null = null

function getAuthAdminClient() {
  if (_adminClient) return _adminClient
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — staff account provisioning requires it."
    )
  }
  _adminClient = createClient(getSupabaseUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _adminClient
}

/**
 * Random password that always satisfies the app's complexity policy
 * (≥8 chars, upper, lower, number, special) regardless of what the
 * random segment happens to contain.
 */
export function generateTempPassword(): string {
  const raw = randomBytes(9).toString("base64url").replace(/[-_]/g, "x")
  return `Jt@${raw}7`
}

export type ProvisionResult =
  | {
      ok: true
      userId: string
      tempPassword: string
      emailSent: boolean
      /**
       * Why the invite email did not go out, verbatim from the provider.
       * Without this the Partner sees only "email not sent" and cannot tell a
       * missing API key from an unverified sender domain.
       */
      emailError?: string
      /** true when an auth account already existed for this email */
      alreadyExisted: false
    }
  | {
      ok: true
      userId: string | null
      tempPassword: null
      emailSent: false
      emailError?: string
      alreadyExisted: true
    }
  | { ok: false; error: string }

export async function provisionStaffAccount(opts: {
  name: string
  email: string
  role: StaffRole
}): Promise<ProvisionResult> {
  const { name, email, role } = opts

  let admin
  try {
    admin = getAuthAdminClient()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Provisioning unavailable." }
  }

  const tempPassword = generateTempPassword()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    // Internal accounts are created by a trusted Partner/Manager — skip the
    // email-confirmation dance so the hire can log in immediately.
    email_confirm: true,
    user_metadata: {
      name,
      role,
      must_change_password: true,
    },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("already") && (msg.includes("registered") || msg.includes("exists"))) {
      // A login already exists — link, don't clobber.
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })
      return {
        ok: true,
        userId: existing?.id ?? null,
        tempPassword: null,
        emailSent: false,
        alreadyExisted: true,
      }
    }
    console.error("[provisioning] createUser failed:", error.message)
    return { ok: false, error: "Could not create the login account. Please try again." }
  }

  const authUserId = data.user.id

  // Mirror into Prisma. Keyed by email so a pre-existing row (e.g. from seed)
  // is updated in place instead of violating the unique email constraint.
  try {
    await prisma.user.upsert({
      where: { email },
      update: { name, role },
      create: { id: authUserId, email, name, role },
    })
  } catch (err) {
    console.error("[provisioning] prisma user mirror failed:", err)
  }

  const invite = await sendInviteEmail({ name, email, role, tempPassword })

  return {
    ok: true,
    userId: authUserId,
    tempPassword,
    emailSent: invite.sent,
    ...(invite.error ? { emailError: invite.error } : {}),
    alreadyExisted: false,
  }
}

async function sendInviteEmail(opts: {
  name: string
  email: string
  role: StaffRole
  tempPassword: string
}): Promise<{ sent: boolean; error?: string }> {
  try {
    const cfg = await getFirmSettings()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const roleLabel = opts.role === "MANAGER" ? "Manager" : "Employee"

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);padding:30px;text-align:center;border-radius:10px 10px 0 0;">
      <h1 style="color:white;margin:0;font-size:28px;">${cfg.firmName}</h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:16px;">Your team account is ready</p>
    </div>
    <div style="background:#f9fafb;padding:30px;border-radius:0 0 10px 10px;">
      <p>Hi ${opts.name},</p>
      <p>You've been added to <strong>${cfg.firmName}</strong>'s workspace as a <strong>${roleLabel}</strong>.</p>
      <div style="background:white;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #3b82f6;">
        <p style="margin:4px 0;"><strong>Login email:</strong> ${opts.email}</p>
        <p style="margin:4px 0;"><strong>Temporary password:</strong> <code style="background:#eef2ff;padding:2px 6px;border-radius:4px;">${opts.tempPassword}</code></p>
      </div>
      <p>You'll be asked to set your own password the first time you sign in.</p>
      <a href="${appUrl}/login" style="display:inline-block;background:#3b82f6;color:white;padding:12px 30px;text-decoration:none;border-radius:6px;margin-top:12px;">Sign in</a>
      <p style="margin-top:24px;font-size:12px;color:#6b7280;">If you weren't expecting this invitation, you can ignore this email.</p>
    </div>
  </div>
</body></html>`

    const result = await resendProvider.send({
      to: opts.email,
      subject: `You've been invited to ${cfg.firmName}`,
      content: html,
      metadata: { kind: "staff_invite" },
    })
    if (!result.success) {
      console.error("[provisioning] invite email rejected:", result.error)
      return { sent: false, error: result.error ?? "Email provider rejected the message." }
    }
    return { sent: true }
  } catch (err) {
    console.error("[provisioning] invite email failed:", err)
    return {
      sent: false,
      error: err instanceof Error ? err.message : "Invite email failed to send.",
    }
  }
}

/**
 * Block or unblock a staff member's ability to log in. Used by
 * disable/enable employee so "disabled" actually means locked out.
 * Best-effort: a failure here should not abort the surrounding action.
 */
export async function setStaffLoginBanned(userId: string, banned: boolean): Promise<boolean> {
  try {
    const admin = getAuthAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      // "none" clears an existing ban; ~100 years is effectively permanent.
      ban_duration: banned ? "876000h" : "none",
    })
    if (error) {
      console.error("[provisioning] ban update failed:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.error("[provisioning] ban update failed:", err)
    return false
  }
}

/** Keep the auth role in sync when a Partner changes a team member's role. */
export async function updateStaffRole(userId: string, role: StaffRole): Promise<boolean> {
  try {
    const admin = getAuthAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { role },
    })
    if (error) {
      console.error("[provisioning] role update failed:", error.message)
      return false
    }
    await prisma.user.update({ where: { id: userId }, data: { role } }).catch(() => {})
    return true
  } catch (err) {
    console.error("[provisioning] role update failed:", err)
    return false
  }
}

/**
 * Reset a staff member's password to a fresh one-time temporary password and
 * force them to choose a new one at next sign-in (must_change_password). Returns
 * the temp password so the admin can hand it over if email delivery isn't set up.
 */
export async function resetStaffPassword(
  userId: string
): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  let admin
  try {
    admin = getAuthAdminClient()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reset unavailable." }
  }

  const tempPassword = generateTempPassword()
  // Preserve existing metadata (name/role); just flip the reset flag.
  const { data: existing } = await admin.auth.admin.getUserById(userId)
  const meta = existing?.user?.user_metadata ?? {}

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { ...meta, must_change_password: true },
  })
  if (error) {
    console.error("[provisioning] password reset failed:", error.message)
    return { ok: false, error: "Could not reset the password. Please try again." }
  }
  return { ok: true, tempPassword }
}
