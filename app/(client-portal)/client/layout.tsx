import { redirect } from "next/navigation"

import { AuthProvider } from "@/components/auth/auth-provider"
import { ErrorBoundary } from "@/components/error/error-boundary"
import { getSession } from "@/lib/auth/session"
import { resolvePortalClient } from "@/lib/client-portal/resolve"
import { ClientSidebar } from "@/components/client-portal/client-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ClientHeader } from "@/components/client-portal/client-header"

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  // Only allow CLIENT role to access this portal
  if (session.user.role !== "CLIENT") {
    redirect("/")
  }

  // Resolution lives in one place now — see lib/client-portal/resolve.ts. It
  // prefers the explicit Client.portalUserId grant and keeps the old email
  // match as a fallback (with the same refuse-on-ambiguity guard) so logins
  // created before portal invites existed keep working.
  const resolved = await resolvePortalClient(session)

  if (!resolved.ok) {
    redirect(
      resolved.reason === "ambiguous"
        ? "/unauthorized?reason=ambiguous_client"
        : "/unauthorized"
    )
  }

  const clientRecord = resolved.client

  return (
    <AuthProvider user={session.user}>
      <ErrorBoundary>
        <TooltipProvider>
          <SidebarProvider defaultOpen={false}>
            {/* Keyboard users can jump past the sidebar/header */}
            <a
              href="#client-main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
              Skip to main content
            </a>
            <ClientSidebar client={clientRecord} />
            <SidebarInset className="min-h-svh bg-background">
              <ClientHeader clientName={clientRecord.name} />
              <main id="client-main" className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </ErrorBoundary>
    </AuthProvider>
  )
}