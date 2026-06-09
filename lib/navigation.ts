import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquare,
  PieChart,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  BarChart3,
  Send,
} from "lucide-react"

import type { AppRole } from "@/lib/auth/types"
import { canAccessRoute } from "@/lib/auth/roles"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  badge?: string | number
  roles?: AppRole[]
}

export const mainNavigation: NavItem[] = [
  { title: "Dashboard",   href: "/",            icon: LayoutDashboard },
  { title: "Clients",     href: "/clients",     icon: Building2 },
  { title: "Work Tracker",href: "/work-tracker",icon: ClipboardList },
  { title: "Compliance",  href: "/compliance",  icon: ShieldCheck },
  { title: "Calendar",    href: "/calendar",    icon: CalendarDays },
  { title: "Payments",    href: "/payments",    icon: Wallet },
  { title: "Documents",   href: "/documents",   icon: FileText },
  { title: "Messaging",   href: "/messaging",   icon: MessageSquare },
  { title: "Reports",     href: "/reports",     icon: PieChart },
  { title: "Employees",   href: "/employees",   icon: Users },
  { title: "Proposals",   href: "/proposals",   icon: Send },
  { title: "Workforce",   href: "/workforce",   icon: BarChart3, roles: ["PARTNER"] },
]

export const systemNavigation: NavItem[] = [
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function filterNavigationByRole<T extends { href: string }>(
  items: T[],
  role: AppRole
): T[] {
  return items.filter((item) => canAccessRoute(role, item.href))
}
