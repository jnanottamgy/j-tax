import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { signOut } from "@/app/actions/auth"
import { getSession } from "@/lib/auth/session"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/dashboard/glass-card"

type UnauthorizedPageProps = {
  searchParams: Promise<{
    from?: string
    reason?: string
  }>
}

export default async function UnauthorizedPage({
  searchParams,
}: UnauthorizedPageProps) {
  const params = await searchParams
  const session = await getSession()

  return (
    <div className="dashboard-gradient flex min-h-svh items-center justify-center p-6">
      <GlassCard
        hover={false}
        className="page-enter w-full max-w-md p-10 text-center"
      >
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-amber-500/5 shadow-[0_8px_32px_-8px_oklch(0.65_0.15_75/30%)]">
          <ShieldAlert className="size-8 text-amber-400" />
        </div>

        <h1 className="text-gradient text-2xl font-semibold tracking-tight">
          Access denied
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {params.reason === "missing_role"
            ? "Your account does not have an assigned role. Contact your administrator."
            : "You do not have permission to view this page with your current role."}
        </p>

        {session && (
          <p className="mt-4 text-[13px] text-muted-foreground/80">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {session.user.email}
            </span>{" "}
            · {ROLE_LABELS[session.user.role]}
          </p>
        )}

        {params.from && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/60">
            Requested: {params.from}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button asChild className="btn-glow h-10 rounded-xl px-5">
            <Link href="/">Go to dashboard</Link>
          </Button>
          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              className="input-premium h-10 w-full rounded-xl sm:w-auto"
            >
              Sign out
            </Button>
          </form>
        </div>
      </GlassCard>
    </div>
  )
}
