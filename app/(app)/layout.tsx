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

  // Onboarding wizard is only relevant for PARTNER and MANAGER (firm setup).
  // EMPLOYEE users have no firm to configure and should go straight to their dashboard.
  const needsOnboarding =
    (session.user.role === "PARTNER" || session.user.role === "MANAGER") &&
    !(await getOnboardingStatus()).completed

  return (
    <AuthProvider user={session.user}>
      <ErrorBoundary>
        {needsOnboarding && <OnboardingWizard />}
        <AppShell>{children}</AppShell>
      </ErrorBoundary>
    </AuthProvider>
  )
}
