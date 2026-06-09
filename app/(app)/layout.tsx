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

  const onboardingStatus = await getOnboardingStatus()

  return (
    <AuthProvider user={session.user}>
      <ErrorBoundary>
        {!onboardingStatus.completed && <OnboardingWizard />}
        <AppShell>{children}</AppShell>
      </ErrorBoundary>
    </AuthProvider>
  )
}
