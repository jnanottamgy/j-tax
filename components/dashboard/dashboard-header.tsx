"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { CommandPalette } from "@/components/command-palette/command-palette"
import { NotificationBell } from "@/components/notifications/notification-bell"

export function DashboardHeader() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  return (
    <>
      <header className="header-glass sticky top-0 z-30 flex h-[3.75rem] shrink-0 items-center gap-4 px-4 md:px-8" role="banner">
        <SidebarTrigger 
          className="-ml-1 size-8 text-muted-foreground transition-colors duration-300 hover:bg-white/[0.05] hover:text-foreground"
          aria-label="Toggle sidebar"
        />

        <div className="hidden flex-1 md:block">
          <div className="relative max-w-lg">
            <Search 
              className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" 
              aria-hidden="true"
            />
            <Input
              placeholder="Search clients, filings, payments..."
              className="input-premium h-10 rounded-xl pl-10 text-sm cursor-pointer"
              readOnly
              onClick={() => setCommandPaletteOpen(true)}
              aria-label="Open command palette (Press ⌘K)"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-foreground/80 sm:flex" aria-hidden="true">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <NotificationBell />

          <Badge
            variant="outline"
            className="hidden border-white/[0.07] bg-white/[0.03] px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground sm:inline-flex"
          >
            FY 2025
          </Badge>

          <Button 
            size="sm" 
            className="btn-glow h-9 gap-1.5 rounded-xl px-4"
            aria-label="Create new filing"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">New Filing</span>
          </Button>
        </div>
      </header>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  )
}
