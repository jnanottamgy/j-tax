import { redirect } from "next/navigation"

import { UpdatePasswordForm } from "@/components/auth/update-password-form"
import { GlassCard } from "@/components/dashboard/glass-card"
import { LogoIcon } from "@/components/ui/logo"
import { createClient } from "@/lib/supabase/server"

/**
 * First-login password setup for provisioned staff accounts.
 *
 * New hires sign in with the temporary password from their invite; the proxy
 * and signIn action route them here (user_metadata.must_change_password)
 * until they choose their own password.
 */
export default async function SetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Already set a personal password — nothing to do here.
  if (!user.user_metadata?.must_change_password) redirect("/")

  const name =
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    user.email ||
    "there"

  return (
    <div className="dashboard-gradient relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.45 0.14 265 / 18%), transparent 70%)",
        }}
      />
      <div className="page-enter relative z-[1] w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center">
            <LogoIcon size={56} glow />
          </div>
          <h1 className="text-gradient text-2xl font-semibold tracking-tight md:text-3xl mt-4">
            Welcome, {name}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Before you get started, choose a password of your own to replace the
            temporary one from your invite.
          </p>
        </div>

        <GlassCard hover={false} className="p-7 md:p-8">
          <UpdatePasswordForm redirectTo="/" />
        </GlassCard>
      </div>
    </div>
  )
}
