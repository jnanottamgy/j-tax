import { redirect } from "next/navigation"

import { AuthProvider } from "@/components/auth/auth-provider"
import { ErrorBoundary } from "@/components/error/error-boundary"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
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

  // Find the Client record for this user — match on email only.
  // HIGH-04: removed GSTIN fallback which allowed any user whose email matched
  // a client's GSTIN to gain access to that client's portal.
  // Client.email is not unique, so if two client records share an email we must
  // NOT silently bind to whichever findFirst returns (cross-client exposure).
  const matches = await prisma.client.findMany({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      pan: true,
      gstin: true,
      status: true,
    },
    take: 2,
  })

  if (matches.length === 0) {
    // No client record found - show unauthorized or redirect
    redirect("/unauthorized")
  }

  if (matches.length > 1) {
    // Ambiguous identity — refuse rather than risk showing the wrong client's data.
    redirect("/unauthorized?reason=ambiguous_client")
  }

  const clientRecord = matches[0]

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