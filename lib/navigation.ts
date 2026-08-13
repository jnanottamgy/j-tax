import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  BookOpenCheck,
  Calculator,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FileWarning,
  IndianRupee,
  GitCompareArrows,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MessageSquare,
  PieChart,
  Receipt,
  Send,
  Settings,
  ShieldCheck,
  Target,
  Timer,
  Trash2,
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
        title: "Clients",
        href: "/clients",
        icon: Building2,
        description: "Client master & onboarding",
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
        title: "GST Recon",
        href: "/gst-reconciliation",
        icon: GitCompareArrows,
        description: "GSTR-2B ↔ purchase register",
      },
      {
        title: "ITR Computation",
        href: "/itr-computation",
        icon: Calculator,
        description: "Old vs new regime, side by side",
      },
      {
        title: "Notices",
        href: "/notices",
        icon: FileWarning,
        description: "Tax notice & litigation register",
      },
      {
        title: "Financial Statements",
        href: "/financial-statements",
        icon: BookOpenCheck,
        description: "P&L + Balance Sheet from trial balance",
      },
      {
        title: "Compliance Calendar",
        href: "/compliance-calendar",
        icon: CalendarDays,
        description: "Statutory, as-per-law due dates",
      },
      {
        title: "Firm Calendar",
        href: "/calendar",
        icon: CalendarDays,
        description: "Firm-set custom due dates",
      },
      {
        title: "Timesheet",
        href: "/timesheet",
        icon: Timer,
        description: "Time tracking & billable hours",
      },
      {
        title: "Client Groups",
        href: "/groups",
        icon: Boxes,
        description: "Group companies & families",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales / CRM",
    items: [
      {
        title: "Leads & Quotations",
        href: "/proposals",
        icon: Target,
        description: "Pipeline, proposals & quotes",
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
        icon: Mail,
        description: "Client emails, templates & reminders",
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
        title: "Revenue",
        href: "/reports/revenue",
        icon: IndianRupee,
        description: "Invoice-level revenue ledger & Excel export",
      },
      {
        title: "Audit Logs",
        href: "/activity",
        icon: Activity,
        description: "Activity history",
      },
      {
        title: "Job Templates",
        href: "/templates",
        icon: LayoutTemplate,
        description: "Reusable engagement checklists",
      },
      {
        title: "Registers",
        href: "/registers",
        icon: KeyRound,
        description: "Credentials, DSC, UDIN & registrations",
      },
      {
        title: "Notifications",
        href: "/notifications",
        icon: Bell,
        description: "Alerts & reminders",
      },
      {
        title: "Recycle Bin",
        href: "/trash",
        icon: Trash2,
        description: "Restore deleted records",
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

  // MANAGER — operations + sales/CRM + team + finance + resources
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
          { title: "GST Recon", href: "/gst-reconciliation", icon: GitCompareArrows, description: "GSTR-2B ↔ purchase register" },
          { title: "ITR Computation", href: "/itr-computation", icon: Calculator, description: "Old vs new regime, side by side" },
          { title: "Notices", href: "/notices", icon: FileWarning, description: "Tax notice & litigation register" },
          { title: "Financial Statements", href: "/financial-statements", icon: BookOpenCheck, description: "P&L + Balance Sheet from trial balance" },
          { title: "Compliance Calendar", href: "/compliance-calendar", icon: CalendarDays, description: "Statutory due dates" },
          { title: "Firm Calendar", href: "/calendar", icon: CalendarDays, description: "Firm-set due dates" },
          { title: "Timesheet", href: "/timesheet", icon: Timer, description: "Time tracking & billable hours" },
        ],
      },
      {
        id: "sales",
        label: "Sales / CRM",
        items: [
          { title: "Leads & Quotations", href: "/proposals", icon: Target, description: "Pipeline, proposals & quotes" },
        ],
      },
      {
        id: "team",
        label: "Team",
        items: [
          { title: "Employees", href: "/employees", icon: Users, description: "Your team members" },
          { title: "Workforce", href: "/workforce", icon: Activity, description: "Team performance & attendance" },
          { title: "Messaging", href: "/messaging", icon: MessageSquare, description: "Communications" },
        ],
      },
      {
        id: "finance",
        label: "Finance",
        items: [
          { title: "Invoices", href: "/payments/invoices", icon: Receipt, description: "Invoice management" },
        ],
      },
      {
        id: "resources",
        label: "Resources",
        items: [
          { title: "Job Templates", href: "/templates", icon: LayoutTemplate, description: "Reusable engagement checklists" },
          { title: "Registers", href: "/registers", icon: KeyRound, description: "Credentials, DSC, UDIN & registrations" },
          { title: "Reports", href: "/reports", icon: PieChart, description: "Analytics & exports" },
          { title: "Revenue", href: "/reports/revenue", icon: IndianRupee, description: "Invoice-level revenue ledger & Excel export" },
          { title: "Notifications", href: "/notifications", icon: Bell, description: "Alerts & reminders" },
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
          { title: "My Timesheet", href: "/timesheet", icon: Timer, description: "Log your hours" },
          { title: "My Clients", href: "/clients", icon: Building2, description: "Clients you manage" },
          { title: "GST Recon", href: "/gst-reconciliation", icon: GitCompareArrows, description: "Reconcile your clients' GSTR-2B" },
          { title: "ITR Computation", href: "/itr-computation", icon: Calculator, description: "Tax computations for your clients" },
          { title: "Notices", href: "/notices", icon: FileWarning, description: "Notices for your clients" },
          { title: "Financial Statements", href: "/financial-statements", icon: BookOpenCheck, description: "Statements for your clients" },
          { title: "Firm Calendar", href: "/calendar", icon: CalendarDays, description: "Firm-set due dates" },
        ],
      },
      {
        id: "resources",
        label: "Resources",
        items: [
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
