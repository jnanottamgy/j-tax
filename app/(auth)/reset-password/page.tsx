import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { GlassCard } from "@/components/dashboard/glass-card"
import { LogoIcon } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"

export default async function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center">
          <LogoIcon size={56} glow />
        </div>
        <h1 className="text-gradient text-2xl font-semibold tracking-tight md:text-3xl mt-4">
          Reset your password
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      <GlassCard hover={false} className="p-7 md:p-8">
        <ResetPasswordForm />
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
  )
}
