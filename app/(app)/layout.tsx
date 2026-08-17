import { redirect } from "next/navigation"

import { AuthProvider } from "@/components/auth/auth-provider"
import { ErrorBoundary } from "@/components/error/error-boundary"
import { AppShell } from "@/components/layout/app-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { SetupPendingBanner } from "@/components/onboarding/setup-pending-banner"
import { getSession } from "@/lib/auth/session"
import { getOnboardingStatus } from "@/app/actions/onboarding"
import { reportError } from "@/lib/observability/report-error"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  // CLIENT-role users belong in the client portal, not the staff app
  if (session.user.role === "CLIENT") {
    redirect("/client")
  }

  // Firm-setup wizard is PARTNER-only: its first step writes firm settings,
  // which the server rejects for MANAGERs — showing them the wizard was a
  // dead end. Managers and employees go straight to their dashboards.
  // Deliberately guarded, and the guard is the point.
  //
  // An error.tsx renders INSIDE the layout of its own segment, so it cannot
  // catch that layout throwing — the failure escapes to the root boundary
  // instead, which is the bare "Something went wrong" page with no sidebar and
  // no context. Anything awaited out here therefore white-screens the whole
  // app rather than one page.
  //
  // getOnboardingStatus calls requireAuth, which throws for a signup whose firm
  // never got provisioned. (Its own body already tries to tolerate a missing
  // user row "rather than crashing the layout" — but the guard above that code
  // throws first, so the protection never applied.)
  //
  // Degrading to "no wizard" keeps the app shell up and pushes the real failure
  // down to the page, where (app)/error.tsx can catch it and show it properly.
  let onboarding: Awaited<ReturnType<typeof getOnboardingStatus>> | null = null
  try {
    onboarding = await getOnboardingStatus()
  } catch (err) {
    reportError(err, { source: "app-layout:getOnboardingStatus", severity: "fatal" })
  }

  const needsOnboarding = session.user.role === "PARTNER" && onboarding !== null && !onboarding.completed
  // A Manager signing into a firm that is still half-configured saw an ordinary
  // empty app with no explanation, which reads as broken rather than as a
  // boundary. Say who has to finish it, once, instead of nothing.
  const setupPendingNotice =
    session.user.role === "MANAGER" && onboarding !== null && !onboarding.completed

  return (
    <AuthProvider user={session.user}>
      <ErrorBoundary>
        {needsOnboarding && <OnboardingWizard />}
        <AppShell>
          {setupPendingNotice && <SetupPendingBanner />}
          {children}
        </AppShell>
      </ErrorBoundary>
    </AuthProvider>
  )
}
