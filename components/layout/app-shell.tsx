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
          <HeartbeatTracker />
          <AppSidebar />
          <SidebarInset className="dashboard-gradient min-h-svh">
            <DashboardHeader />
            <div className="relative z-[1] flex-1 overflow-auto">{children}</div>
          </SidebarInset>
        </NotificationsProvider>
      </SidebarProvider>
    </TooltipProvider>
  )
}
