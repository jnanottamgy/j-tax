"use client"

import { Menu } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationBell } from "@/components/notifications/notification-bell"

interface ClientHeaderProps {
  clientName: string
}

export function ClientHeader({ clientName }: ClientHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger
        className="-ml-1 size-8"
        aria-label="Toggle sidebar"
      >
        <Menu className="size-4" />
      </SidebarTrigger>

      <div className="flex-1">
        <h1 className="text-base font-semibold">Welcome back, {clientName}</h1>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>
    </header>
  )
}