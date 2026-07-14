"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Plus,
  Receipt,
  Search,
  UserPlus,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CommandPalette } from "@/components/command-palette/command-palette"
import { HelpButton, HelpCenter } from "@/components/help-center/help-center"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { useAuth } from "@/components/auth/auth-provider"
import { canAccessRoute } from "@/lib/auth/roles"

/** Indian financial year runs Apr–Mar: Jul 2026 → start year 2026. */
function currentStartYear(): number {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

const GRANULARITIES = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const

/**
 * Dashboard period control: shift the financial year with ◀/▶ and pick a
 * Daily / Monthly / Yearly granularity. Selection lives in the URL (?fy&g) so
 * the revenue trend chart can react. Only rendered on the dashboard route.
 */
function DashboardPeriodControl() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Only meaningful on the dashboard (route "/") where the trend chart lives.
  const isDashboard = pathname === "/"

  const fyParam = searchParams.get("fy")
  const startYear = fyParam?.match(/(\d{4})/) ? Number(fyParam.match(/(\d{4})/)![1]) : currentStartYear()
  const granularity = searchParams.get("g") ?? "monthly"
  const fyShort = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`

  if (!isDashboard) {
    return (
      <Badge
        variant="outline"
        className="hidden border-white/[0.07] bg-white/[0.03] px-2.5 text-[11px] font-medium tracking-wide text-muted-foreground sm:inline-flex"
      >
        FY {fyShort}
      </Badge>
    )
  }

  function setParams(next: { fy?: string; g?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.fy !== undefined) params.set("fy", next.fy)
    if (next.g !== undefined) params.set("g", next.g)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function shiftYear(delta: number) {
    const y = startYear + delta
    setParams({ fy: `${y}-${String((y + 1) % 100).padStart(2, "0")}` })
  }

  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      <div className="flex items-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
        <button
          type="button"
          onClick={() => shiftYear(-1)}
          className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Previous financial year"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground tabular-nums">
          FY {fyShort}
        </span>
        <button
          type="button"
          onClick={() => shiftYear(1)}
          disabled={startYear >= currentStartYear()}
          className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Next financial year"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 rounded-lg border-white/[0.07] bg-white/[0.03] px-2 text-[11px] font-medium text-muted-foreground">
            {GRANULARITIES.find((g) => g.value === granularity)?.label ?? "Monthly"}
            <ChevronDown className="size-3 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuLabel>Granularity</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {GRANULARITIES.map((g) => (
            <DropdownMenuItem key={g.value} onClick={() => setParams({ g: g.value })}>
              {g.label}
              {granularity === g.value && " ✓"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// Global quick-create actions. Each `access` route is checked against the
// signed-in role so staff never see doors they can't open. `href` deep-links
// to the destination with the create dialog already opening (?new=1).
// `managerial` marks creations whose server actions are Partner/Manager-only
// even though the destination page itself is visible to employees.
const QUICK_CREATE = [
  { label: "New Client", href: "/clients?new=1", access: "/clients", icon: Building2, managerial: true },
  { label: "New Task", href: "/work-tracker?new=1", access: "/work-tracker", icon: ClipboardList, managerial: true },
  { label: "New Filing", href: "/compliance?new=1", access: "/compliance", icon: CalendarClock, managerial: true },
  { label: "New Lead", href: "/proposals?new=1", access: "/proposals", icon: UserPlus, managerial: false },
  { label: "New Quotation", href: "/proposals/quotations/new", access: "/proposals", icon: FileText, managerial: false },
  { label: "New Invoice", href: "/payments/invoices?new=1", access: "/payments", icon: Receipt, managerial: false },
] as const

export function DashboardHeader() {
  const { role } = useAuth()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const createActions = QUICK_CREATE.filter(
    (a) => canAccessRoute(role, a.access) && !(a.managerial && role === "EMPLOYEE")
  )

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
          <ThemeToggle />
          <HelpButton onClick={() => setHelpOpen(true)} />
          <NotificationBell />

          <DashboardPeriodControl />

          {createActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="btn-glow h-9 gap-1.5 rounded-xl px-4"
                  aria-label="Create new"
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">New</span>
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Create</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {createActions.map((action) => (
                  <DropdownMenuItem key={action.label} asChild>
                    <Link href={action.href} className="cursor-pointer">
                      <action.icon className="mr-2 size-4" aria-hidden="true" />
                      {action.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      {helpOpen && <HelpCenter open={helpOpen} onClose={() => setHelpOpen(false)} />}
    </>
  )
}
