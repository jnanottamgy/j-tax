import { redirect } from "next/navigation"

import { AuthProvider } from "@/components/auth/auth-provider"
import { ErrorBoundary } from "@/components/error/error-boundary"
import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { ClientSidebar } from "@/components/client-portal/client-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
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
  const clientRecord = await prisma.client.findFirst({
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
  })

  if (!clientRecord) {
    // No client record found - show unauthorized or redirect
    redirect("/unauthorized")
  }

  return (
    <AuthProvider user={session.user}>
      <ErrorBoundary>
        <TooltipProvider>
          <SidebarProvider defaultOpen={false}>
            <ClientSidebar client={clientRecord} />
            <SidebarInset className="min-h-svh bg-background">
              <ClientHeader clientName={clientRecord.name} />
              <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </ErrorBoundary>
    </AuthProvider>
  )
}