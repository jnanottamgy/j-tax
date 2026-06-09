import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { GlassCard } from "@/components/dashboard/glass-card"

import { LogoIcon } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"

type LoginPageProps = {
  searchParams: Promise<{
    redirectTo?: string
    error?: string
    signup?: string
    password?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const redirectTo = params.redirectTo ?? "/"

  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center">
          <LogoIcon size={56} glow />
        </div>
        <h1 className="text-gradient text-2xl font-semibold tracking-tight md:text-3xl mt-4">
          Sign in to J-TAX
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Enterprise tax operations for partners, managers, and executives
        </p>
      </div>

      <GlassCard hover={false} className="p-7 md:p-8">
        {params.error === "auth_callback_failed" && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            Authentication failed. Please sign in again.
          </div>
        )}
        {params.signup === "success" && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-400"
          >
            Account created successfully! Please sign in.
          </div>
        )}
        {params.password === "updated" && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm text-green-400"
          >
            Password updated successfully! Please sign in.
          </div>
        )}
        <LoginForm redirectTo={redirectTo} />
      </GlassCard>

      <div className="flex flex-col gap-2 text-center">
        <Button variant="ghost" asChild className="text-sm">
          <Link href="/reset-password">Forgot password?</Link>
        </Button>
        <Button variant="ghost" asChild className="text-sm">
          <Link href="/signup">Don't have an account? Sign up</Link>
        </Button>
        <p className="text-[13px] leading-relaxed text-muted-foreground/80">
          Access is restricted to authorized firm personnel. Contact your
          administrator if you need an account.
        </p>
      </div>
    </div>
  )
}
