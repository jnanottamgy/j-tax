import { redirect } from "next/navigation"

import { AuthProvider } from "@/components/auth/auth-provider"
import { ErrorBoundary } from "@/components/error/error-boundary"
import { AppShell } from "@/components/layout/app-shell"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"
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
  const needsOnboarding =
    session.user.role === "PARTNER" && !(await getOnboardingStatus()).completed

  return (
    <AuthProvider user={session.user}>
      <ErrorBoundary>
        {needsOnboarding && <OnboardingWizard />}
        <AppShell>{children}</AppShell>
      </ErrorBoundary>
    </AuthProvider>
  )
}
