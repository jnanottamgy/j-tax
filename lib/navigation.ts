import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  PieChart,
  Receipt,
  Send,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react"

import type { AppRole } from "@/lib/auth/types"
import { canAccessRoute } from "@/lib/auth/roles"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  badge?: string | number
  description?: string
}

export type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

export const navigationGroups: NavGroup[] = [
  {
    id: "operations",
    label: "Operations",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        description: "Overview & KPIs",
      },
      {
        title: "Client Master",
        href: "/clients",
        icon: Building2,
        description: "All client accounts",
      },
      {
        title: "Client Onboarding",
        href: "/clients",
        icon: UserPlus,
        description: "Add & onboard new clients",
      },
      {
        title: "Work Tracker",
        href: "/work-tracker",
        icon: ClipboardList,
        description: "Tasks & assignments",
      },
      {
        title: "Compliance",
        href: "/compliance",
        icon: ShieldCheck,
        description: "Filing compliance",
      },
      {
        title: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        description: "Compliance calendar",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      {
        title: "Payments",
        href: "/payments",
        icon: Wallet,
        description: "Payment tracking",
      },
      {
        title: "Invoices",
        href: "/payments/invoices",
        icon: Receipt,
        description: "Invoice management",
      },
      {
        title: "Quotations",
        href: "/proposals",
        icon: Send,
        description: "Proposals & quotes",
      },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      {
        title: "Employees",
        href: "/employees",
        icon: Users,
        description: "Team management",
      },
      {
        title: "Performance",
        href: "/workforce",
        icon: BarChart3,
        description: "Workforce analytics",
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      {
        title: "Messaging",
        href: "/messaging",
        icon: MessageSquare,
        description: "WhatsApp & SMS",
      },
      {
        title: "Email Automation",
        href: "/messaging",
        icon: Mail,
        description: "Automated campaigns",
      },
    ],
  },
  {
    id: "management",
    label: "Management",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: PieChart,
        description: "Analytics & exports",
      },
      {
        title: "Audit Logs",
        href: "/activity",
        icon: Activity,
        description: "Activity history",
      },
      {
        title: "Documents",
        href: "/documents",
        icon: FileText,
        description: "Document vault",
      },
      {
        title: "Approvals",
        href: "/proposals",
        icon: CheckSquare,
        description: "Pending approvals",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Platform settings",
      },
    ],
  },
]

// Flat list kept for backward compatibility (command palette, etc.)
export const mainNavigation: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Clients", href: "/clients", icon: Building2 },
  { title: "Work Tracker", href: "/work-tracker", icon: ClipboardList },
  { title: "Compliance", href: "/compliance", icon: ShieldCheck },
  { title: "Calendar", href: "/calendar", icon: CalendarDays },
  { title: "Payments", href: "/payments", icon: Wallet },
  { title: "Invoices", href: "/payments/invoices", icon: Receipt },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Messaging", href: "/messaging", icon: MessageSquare },
  { title: "Reports", href: "/reports", icon: PieChart },
  { title: "Employees", href: "/employees", icon: Users },
  { title: "Proposals", href: "/proposals", icon: Send },
  { title: "Workforce", href: "/workforce", icon: BarChart3 },
  { title: "Audit Logs", href: "/activity", icon: Activity },
]

export const systemNavigation: NavItem[] = [
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function isNavActive(pathname: string, href: string): boolean {
  const cleanHref = href.split("?")[0]
  if (cleanHref === "/") return pathname === "/"
  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`)
}

export function filterNavigationByRole<T extends NavItem>(
  items: T[],
  role: AppRole
): T[] {
  return items.filter((item) => canAccessRoute(role, item.href.split("?")[0]))
}

export function filterGroupsByRole(
  groups: NavGroup[],
  role: AppRole
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavigationByRole(group.items, role),
    }))
    .filter((group) => group.items.length > 0)
}
