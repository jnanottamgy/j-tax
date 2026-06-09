"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronUp, LogOut, Search } from "lucide-react"

import { signOut } from "@/app/actions/auth"
import { useAuth } from "@/components/auth/auth-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
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
  filterNavigationByRole,
  isNavActive,
  mainNavigation,
  systemNavigation,
  type NavItem,
} from "@/lib/navigation"
import { cn } from "@/lib/utils"

import { LogoFull, LogoIcon } from "@/components/ui/logo"

function NavLink({ title, href, icon: Icon, badge }: NavItem) {
  const pathname = usePathname()
  const active = isNavActive(pathname, href)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={title}
        className={cn(
          "relative transition-all duration-300 ease-out",
          active &&
            "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_oklch(0.7_0.16_265/22%)] hover:bg-primary/14 hover:text-primary data-active:bg-primary/12 data-active:text-primary"
        )}
      >
        <Link href={href}>
          <Icon
            className={cn(
              "transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          />
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
      {badge !== undefined && (
        <SidebarMenuBadge
          className={cn(
            "bg-primary/15 text-[10px] font-semibold text-primary",
            active && "bg-primary/25"
          )}
        >
          {badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  )
}

export function AppSidebar() {
  const { user } = useAuth()
  const initials = getUserInitials(user.name)

  const visibleMainNav = filterNavigationByRole(mainNavigation, user.role)
  const visibleSystemNav = filterNavigationByRole(systemNavigation, user.role)

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="border-none [--sidebar-width:15.5rem]"
    >
      <SidebarHeader className="gap-3 p-3">
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

        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput
            placeholder="Search..."
            className="input-premium h-9 rounded-xl pl-8 text-xs"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-2 bg-white/[0.06]" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSystemNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/[0.06] p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
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
