import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { UpdatePasswordForm } from "@/components/auth/update-password-form"
import { GlassCard } from "@/components/dashboard/glass-card"
import { LogoIcon } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"

type Props = {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const params = await searchParams

  // Surface any errors Supabase sent in the redirect (e.g. expired link)
  if (params.error) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        params.error_description ?? params.error
      )}`
    )
  }

  if (!params.code) {
    // No code — link is invalid or already used
    redirect("/reset-password?error=invalid_link")
  }

  // Exchange the PKCE code for a session so updateUser() works
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(params.code)

  if (error) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        error.message.includes("expired")
          ? "Reset link has expired. Please request a new one."
          : "Invalid reset link. Please request a new one."
      )}`
    )
  }

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
            Set new password
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <GlassCard hover={false} className="p-7 md:p-8">
          <UpdatePasswordForm />
        </GlassCard>

        <div className="text-center">
          <Button variant="ghost" asChild className="text-sm">
            <Link href="/login" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
