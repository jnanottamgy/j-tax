"use client"

import {
  LayoutDashboard,
  FileText,
  Upload,
  ClipboardList,
  Receipt,
  MessageSquare,
  Calendar,
  HelpCircle,
  LogOut,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "@/app/actions/auth"
import { LogoFull } from "@/components/ui/logo"

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
    title: "Document Requests",
    href: "/client/requests",
    icon: ClipboardList,
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
        <LogoFull iconSize={26} />
        <span className="text-xs font-medium text-muted-foreground tracking-wide ml-1">
          Portal
        </span>
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
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="size-4" />
            <span>Sign Out</span>
          </button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}