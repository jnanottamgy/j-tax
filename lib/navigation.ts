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
  Star,
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

// ─── Full navigation tree (all roles) ────────────────────────────────────────

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

// ─── Role-specific navigation overrides ──────────────────────────────────────

/** Returns navigation groups tailored to the viewer's role. */
export function getNavigationForRole(role: AppRole): NavGroup[] {
  // PARTNER sees the full tree (role-filtered by canAccessRoute)
  if (role === "PARTNER") {
    return filterGroupsByRole(navigationGroups, role)
  }

  // MANAGER — operations + team + quotations + documents + settings
  if (role === "MANAGER") {
    return [
      {
        id: "operations",
        label: "Operations",
        items: [
          { title: "Dashboard", href: "/", icon: LayoutDashboard, description: "Overview & KPIs" },
          { title: "Clients", href: "/clients", icon: Building2, description: "Client management" },
          { title: "Work Tracker", href: "/work-tracker", icon: ClipboardList, description: "Tasks & assignments" },
          { title: "Compliance", href: "/compliance", icon: ShieldCheck, description: "Filing compliance" },
          { title: "Calendar", href: "/calendar", icon: CalendarDays, description: "Compliance calendar" },
        ],
      },
      {
        id: "team",
        label: "Team",
        items: [
          { title: "Employees", href: "/employees", icon: Users, description: "Your team members" },
          { title: "Messaging", href: "/messaging", icon: MessageSquare, description: "Communications" },
        ],
      },
      {
        id: "finance",
        label: "Finance",
        items: [
          { title: "Payments", href: "/payments", icon: Wallet, description: "Payment tracking" },
          { title: "Invoices", href: "/payments/invoices", icon: Receipt, description: "Invoice management" },
          { title: "Quotations", href: "/proposals", icon: Send, description: "Proposals & quotes" },
        ],
      },
      {
        id: "resources",
        label: "Resources",
        items: [
          { title: "Documents", href: "/documents", icon: FileText, description: "Document vault" },
          { title: "Reports", href: "/reports", icon: PieChart, description: "Analytics & exports" },
          { title: "Settings", href: "/settings", icon: Settings, description: "Account settings" },
        ],
      },
    ]
  }

  // EMPLOYEE — personal work view only
  if (role === "EMPLOYEE") {
    return [
      {
        id: "my-work",
        label: "My Work",
        items: [
          { title: "My Dashboard", href: "/", icon: LayoutDashboard, description: "Your personal dashboard" },
          { title: "My Tasks", href: "/work-tracker", icon: ClipboardList, description: "Tasks assigned to you" },
          { title: "My Clients", href: "/clients", icon: Building2, description: "Clients you manage" },
          { title: "Compliance Work", href: "/compliance", icon: ShieldCheck, description: "Compliance for your clients" },
          { title: "Calendar", href: "/calendar", icon: CalendarDays, description: "Upcoming deadlines" },
        ],
      },
      {
        id: "resources",
        label: "Resources",
        items: [
          { title: "Documents", href: "/documents", icon: FileText, description: "Client documents" },
          { title: "Messaging", href: "/messaging", icon: MessageSquare, description: "Communications" },
        ],
      },
      {
        id: "personal",
        label: "Personal",
        items: [
          { title: "Notifications", href: "/notifications", icon: Bell, description: "Alerts & reminders" },
          { title: "Settings", href: "/settings", icon: Settings, description: "Your preferences" },
        ],
      },
    ]
  }

  // CLIENT — handled by client portal, should not reach app layout
  return []
}

// ─── Legacy flat exports (backward compat) ────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
