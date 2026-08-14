import { redirect } from "next/navigation"

import { AuthProvider } from "@/components/auth/auth-provider"
import { ErrorBoundary } from "@/components/error/error-boundary"
import { AppShell } from "@/components/layout/app-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
import { SetupPendingBanner } from "@/components/onboarding/setup-pending-banner"
import { getSession } from "@/lib/auth/session"
import { getOnboardingStatus } from "@/app/actions/onboarding"

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
  const onboarding = await getOnboardingStatus()
  const needsOnboarding = session.user.role === "PARTNER" && !onboarding.completed
  // A Manager signing into a firm that is still half-configured saw an ordinary
  // empty app with no explanation, which reads as broken rather than as a
  // boundary. Say who has to finish it, once, instead of nothing.
  const setupPendingNotice = session.user.role === "MANAGER" && !onboarding.completed

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
