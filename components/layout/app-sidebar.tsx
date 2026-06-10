"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  LogOut,
  Receipt,
  Send,
  Star,
  Zap,
} from "lucide-react"

import { signOut } from "@/app/actions/auth"
import { useAuth } from "@/components/auth/auth-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { getUserInitials } from "@/lib/auth/utils"
import {
  filterGroupsByRole,
  isNavActive,
  navigationGroups,
  type NavGroup,
  type NavItem,
} from "@/lib/navigation"
import { useSidebarStore } from "@/lib/stores/sidebar-store"
import { cn } from "@/lib/utils"
import { LogoFull, LogoIcon } from "@/components/ui/logo"

// ─── Quick Actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "New Client", href: "/clients", icon: Building2 },
  { label: "New Task", href: "/work-tracker", icon: ClipboardList },
  { label: "New Invoice", href: "/payments/invoices", icon: Receipt },
  { label: "New Quote", href: "/proposals/quotations/new", icon: Send },
]

// ─── Individual nav item ────────────────────────────────────────────────────────

function NavItemRow({
  item,
  showFavControl,
}: {
  item: NavItem
  showFavControl?: boolean
}) {
  const pathname = usePathname()
  const active = isNavActive(pathname, item.href)
  const { state } = useSidebar()
  const isExpanded = state === "expanded"
  const { isFavorite, addFavorite, removeFavorite } = useSidebarStore()
  const starred = isFavorite(item.href + "|" + item.title)

  return (
    <SidebarMenuItem className="group/navitem relative">
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.description ? `${item.title} — ${item.description}` : item.title}
        className={cn(
          "h-9 transition-all duration-200",
          isExpanded && showFavControl && "pr-8",
          active &&
            "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_oklch(0.7_0.16_265/18%)] hover:bg-primary/12 data-active:bg-primary/10 data-active:text-primary"
        )}
      >
        <Link href={item.href}>
          <item.icon
            className={cn(
              "size-4 shrink-0 transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span className="truncate text-[13px]">{item.title}</span>
        </Link>
      </SidebarMenuButton>

      {/* Star button: only visible in expanded mode, appears on hover */}
      {showFavControl && isExpanded && (
        <button
          type="button"
          onClick={() =>
            starred
              ? removeFavorite(item.href + "|" + item.title)
              : addFavorite(item.href + "|" + item.title)
          }
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 transition-all duration-150",
            starred
              ? "text-amber-400"
              : "text-muted-foreground/35 opacity-0 hover:text-amber-400 group-hover/navitem:opacity-100"
          )}
          title={starred ? "Remove from favorites" : "Add to favorites"}
        >
          <Star className={cn("size-3", starred && "fill-amber-400")} />
        </button>
      )}
    </SidebarMenuItem>
  )
}

// ─── Collapsible group section ──────────────────────────────────────────────────

function NavGroupSection({ group }: { group: NavGroup }) {
  const { state: sidebarState } = useSidebar()
  const { isGroupCollapsed, toggleGroup } = useSidebarStore()
  const groupCollapsed = isGroupCollapsed(group.id)

  return (
    <div>
      {/* Group header — hidden in icon mode */}
      {sidebarState === "expanded" && (
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          className="flex w-full items-center gap-1 px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 transition-colors hover:text-muted-foreground/80"
        >
          <span className="flex-1 text-left">{group.label}</span>
          {groupCollapsed ? (
            <ChevronRight className="size-3 opacity-50" />
          ) : (
            <ChevronDown className="size-3 opacity-50" />
          )}
        </button>
      )}

      {/* Items: always visible in icon mode; togglable in expanded mode */}
      {(!groupCollapsed || sidebarState === "collapsed") && (
        <SidebarMenu>
          {group.items.map((item) => (
            <NavItemRow
              key={`${group.id}|${item.href}|${item.title}`}
              item={item}
              showFavControl
            />
          ))}
        </SidebarMenu>
      )}
    </div>
  )
}

// ─── Favorites section ──────────────────────────────────────────────────────────

function FavoritesSection() {
  const pathname = usePathname()
  const { favorites, removeFavorite } = useSidebarStore()
  const { state } = useSidebar()
  const allItems = navigationGroups.flatMap((g) => g.items)

  const favoriteItems = favorites
    .map((key) => {
      const [href, title] = key.split("|")
      return allItems.find((item) => item.href === href && item.title === title)
    })
    .filter(Boolean) as NavItem[]

  if (favoriteItems.length === 0) return null

  return (
    <>
      {state === "expanded" && (
        <div className="px-3 pb-1 pt-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">
            <Star className="size-2.5 fill-amber-400/60 text-amber-400" />
            Favorites
          </span>
        </div>
      )}
      <SidebarMenu>
        {favoriteItems.map((item) => (
          <SidebarMenuItem key={`fav|${item.href}|${item.title}`} className="group/favitem relative">
            <SidebarMenuButton
              asChild
              isActive={isNavActive(pathname, item.href)}
              tooltip={item.title}
              className="h-9 transition-all duration-200 pr-8"
            >
              <Link href={item.href}>
                <item.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-[13px]">{item.title}</span>
              </Link>
            </SidebarMenuButton>
            {state === "expanded" && (
              <button
                type="button"
                onClick={() => removeFavorite(item.href + "|" + item.title)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-amber-400 opacity-0 transition-all duration-150 group-hover/favitem:opacity-100"
                title="Remove from favorites"
              >
                <Star className="size-3 fill-amber-400" />
              </button>
            )}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarSeparator className="mx-2 my-1.5 bg-white/[0.06]" />
    </>
  )
}

// ─── Recent items section ───────────────────────────────────────────────────────

function RecentItemsSection() {
  const { recentItems } = useSidebarStore()
  const { state } = useSidebar()
  const allItems = navigationGroups.flatMap((g) => g.items)

  const recent = recentItems
    .slice(0, 3)
    .map((r) =>
      allItems.find((item) => item.href === r.href && item.title === r.title)
    )
    .filter(Boolean) as NavItem[]

  if (recent.length === 0) return null

  return (
    <>
      {state === "expanded" && (
        <div className="px-3 pb-1 pt-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            <Clock className="size-2.5" />
            Recent
          </span>
        </div>
      )}
      <SidebarMenu>
        {recent.map((item) => (
          <NavItemRow
            key={`recent|${item.href}|${item.title}`}
            item={item}
          />
        ))}
      </SidebarMenu>
      <SidebarSeparator className="mx-2 my-1.5 bg-white/[0.06]" />
    </>
  )
}

// ─── Quick actions section ──────────────────────────────────────────────────────

function QuickActionsSection() {
  const { state } = useSidebar()

  if (state === "collapsed") {
    return (
      <SidebarMenu className="mb-1">
        {QUICK_ACTIONS.map((action) => (
          <SidebarMenuItem key={action.label}>
            <SidebarMenuButton
              asChild
              tooltip={action.label}
              className="h-9 text-muted-foreground/70 hover:text-foreground"
            >
              <Link href={action.href}>
                <action.icon className="size-4 shrink-0" />
                <span>{action.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    )
  }

  return (
    <>
      <div className="px-3 pb-1 pt-3">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          <Zap className="size-2.5" />
          Quick Actions
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 px-2 pb-1">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-all hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-foreground"
          >
            <action.icon className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{action.label}</span>
          </Link>
        ))}
      </div>
      <SidebarSeparator className="mx-2 my-1.5 bg-white/[0.06]" />
    </>
  )
}

// ─── Root sidebar ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const initials = getUserInitials(user.name)
  const { addRecentItem } = useSidebarStore()
  const visibleGroups = filterGroupsByRole(navigationGroups, user.role)

  // Track visited pages as recent items (most-specific href wins)
  useEffect(() => {
    const allItems = navigationGroups.flatMap((g) => g.items)
    const match = allItems
      .filter((item) => isNavActive(pathname, item.href))
      .sort(
        (a, b) =>
          b.href.split("?")[0].length - a.href.split("?")[0].length
      )[0]
    if (match) {
      addRecentItem({ href: match.href, title: match.title })
    }
  }, [pathname, addRecentItem])

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="border-none [--sidebar-width:16rem] [--sidebar-width-icon:3.5rem]"
    >
      {/* ── Logo ── */}
      <SidebarHeader className="gap-0 p-3 pb-2">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-1 py-1 transition-opacity hover:opacity-90 group-data-[collapsible=icon]:justify-center"
        >
          <div className="group-data-[collapsible=icon]:hidden">
            <LogoFull iconSize={32} glow showTagline />
          </div>
          <div className="hidden group-data-[collapsible=icon]:block">
            <LogoIcon size={32} glow />
          </div>
        </Link>
      </SidebarHeader>

      {/* ── Scrollable content ── */}
      <SidebarContent className="overflow-y-auto px-1">
        <QuickActionsSection />
        <FavoritesSection />
        <RecentItemsSection />

        {/* Navigation groups */}
        {visibleGroups.map((group, i) => (
          <div key={group.id}>
            {i > 0 && (
              <SidebarSeparator className="mx-2 my-1 bg-white/[0.05]" />
            )}
            <NavGroupSection group={group} />
          </div>
        ))}

        {/* Bottom padding */}
        <div className="h-3" />
      </SidebarContent>

      {/* ── User footer ── */}
      <SidebarFooter className="border-t border-white/[0.06] p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={`${user.name} · ${ROLE_LABELS[user.role]}`}
                  className="rounded-xl data-[state=open]:bg-sidebar-accent"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
                    {initials}
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {ROLE_LABELS[user.role]} · {user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4 opacity-60 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-56 border-white/[0.08] bg-popover/95 backdrop-blur-xl"
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings">Account settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <form action={signOut} className="w-full">
                    <button
                      type="submit"
                      className="flex w-full cursor-default items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-destructive outline-hidden"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
