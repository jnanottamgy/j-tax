"use client"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { HeartbeatTracker } from "@/components/layout/heartbeat-tracker"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { NotificationsProvider } from "@/components/notifications/notifications-provider"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <NotificationsProvider>
          {/* Keyboard users can jump past the sidebar/header */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          <HeartbeatTracker />
          <AppSidebar />
          <SidebarInset className="dashboard-gradient min-h-svh">
            <DashboardHeader />
            <main id="main-content" className="relative z-[1] flex-1 overflow-auto">
              {children}
            </main>
          </SidebarInset>
        </NotificationsProvider>
      </SidebarProvider>
    </TooltipProvider>
  )
}
