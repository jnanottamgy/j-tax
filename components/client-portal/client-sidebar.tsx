"use client"

import {
  LayoutDashboard,
  FileText,
  Upload,
  Receipt,
  MessageSquare,
  Calendar,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/client",
    icon: LayoutDashboard,
  },
  {
    title: "Compliance",
    href: "/client/compliance",
    icon: FileText,
  },
  {
    title: "Documents",
    href: "/client/documents",
    icon: Upload,
  },
  {
    title: "Invoices",
    href: "/client/invoices",
    icon: Receipt,
  },
  {
    title: "Messages",
    href: "/client/messages",
    icon: MessageSquare,
  },
  {
    title: "Deadlines",
    href: "/client/deadlines",
    icon: Calendar,
  },
]

const footerNavItems = [
  {
    title: "Settings",
    href: "/client/settings",
    icon: Settings,
  },
  {
    title: "Help & Support",
    href: "/client/help",
    icon: HelpCircle,
  },
]

interface ClientSidebarProps {
  client: {
    id: string
    name: string
    email: string | null
  }
}

export function ClientSidebar({ client }: ClientSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r bg-card">
      {/* Logo & Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-sm font-bold">J</span>
        </div>
        <span className="font-semibold">J-TAX Portal</span>
      </div>

      <SidebarContent>
        {/* Client Info */}
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">{client.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {client.email}
          </p>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                    }
                    className={cn(
                      pathname === item.href ||
                        pathname.startsWith(`${item.href}/`)
                        ? "bg-accent text-accent-foreground"
                        : ""
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer Navigation */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Support</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {footerNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <button
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={() => window.location.href = "/api/auth/signout"}
        >
          <LogOut className="size-4" />
          <span>Sign Out</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  )
}