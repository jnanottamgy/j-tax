"use server"

import { requireAuth } from "@/lib/auth/guards"
import { getExecutiveEmployeeId } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"

export interface SearchResult {
  type: string
  id: string
  title: string
  subtitle?: string
  url: string
  icon?: string
  score?: number
}

const MAX_QUERY_LENGTH = 100 // LOW-02: cap stored query length

// Improved fuzzy matching function with typo tolerance
function fuzzyMatch(text: string, query: string): number {
  if (!query) return 0
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  if (lowerText === lowerQuery) return 100
  if (lowerText.startsWith(lowerQuery)) return 80
  if (lowerText.includes(lowerQuery)) return 60

  let score = 0
  let queryIndex = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10
      queryIndex++
    }
  }
  if (queryIndex === lowerQuery.length) score += 20

  if (score < 60 && lowerQuery.length >= 2) {
    for (let i = 0; i < lowerQuery.length - 1; i++) {
      const transposed =
        lowerQuery.slice(0, i) + lowerQuery[i + 1] + lowerQuery[i] + lowerQuery.slice(i + 2)
      if (lowerText.includes(transposed)) {
        score = Math.max(score, 50)
        break
      }
    }
  }

  if (score < 50 && lowerQuery.length > 2) {
    for (let i = 0; i < lowerQuery.length; i++) {
      const missingChar = lowerQuery.slice(0, i) + lowerQuery.slice(i + 1)
      if (lowerText.includes(missingChar)) {
        score = Math.max(score, 40)
        break
      }
    }
  }

  return score
}

export async function globalSearch(query: string) {
  const session = await requireAuth()
  const user = session.user
  const role = user.role

  // LOW-02: reject oversized queries before hitting the DB
  if (query.length > MAX_QUERY_LENGTH) {
    return { results: [], user }
  }

  const results: SearchResult[] = []

  // CRIT-03: resolve the employee ID once, used for all EXECUTIVE filters below
  const executiveEmployeeId = await getExecutiveEmployeeId(session)

  // Log search analytics (LOW-02: truncate before storing)
  if (query.length >= 2) {
    const safeQuery = query.slice(0, MAX_QUERY_LENGTH)
    try {
      await prisma.activityLog.create({
        data: {
          entityType: "SEARCH",
          entityId: safeQuery,
          action: "SEARCH",
          description: `User searched`,
          userId: user.id,
          userName: user.name,
          metadata: { role, timestamp: new Date().toISOString() },
        },
      })
    } catch {
      // Don't fail search if analytics fails
    }
  }

  if (query.length < 2) return { results, user }

  // Search Clients — CRIT-03: correct EXECUTIVE scope via object spread (not array spread)
  {
    const clientWhere: Record<string, unknown> = {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { clientCode: { contains: query, mode: "insensitive" } },
        { gstin: { contains: query, mode: "insensitive" } },
        { pan: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
      ],
    }
    if (role === "EXECUTIVE") {
      if (!executiveEmployeeId) {
        // EXECUTIVE with no linked employee sees nothing
      } else {
        clientWhere.assignedEmployeeId = executiveEmployeeId
        const clients = await prisma.client.findMany({ where: clientWhere as any, take: 5 })
        clients.forEach((client) => {
          results.push({
            type: "CLIENT",
            id: client.id,
            title: client.name,
            subtitle: client.clientCode,
            url: `/clients/${client.id}`,
            icon: "Building2",
            score: Math.max(
              fuzzyMatch(client.name, query),
              fuzzyMatch(client.clientCode, query),
              fuzzyMatch(client.gstin || "", query),
              fuzzyMatch(client.pan || "", query),
            ),
          })
        })
      }
    } else {
      const clients = await prisma.client.findMany({ where: clientWhere as any, take: 5 })
      clients.forEach((client) => {
        results.push({
          type: "CLIENT",
          id: client.id,
          title: client.name,
          subtitle: client.clientCode,
          url: `/clients/${client.id}`,
          icon: "Building2",
          score: Math.max(
            fuzzyMatch(client.name, query),
            fuzzyMatch(client.clientCode, query),
            fuzzyMatch(client.gstin || "", query),
            fuzzyMatch(client.pan || "", query),
          ),
        })
      })
    }
  }

  // Search Tasks — CRIT-03: correct EXECUTIVE scope
  {
    const taskWhere: Record<string, unknown> = {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ],
    }
    if (role === "EXECUTIVE") {
      if (executiveEmployeeId) {
        taskWhere.assignedEmployeeId = executiveEmployeeId
      } else {
        // no linked employee — return nothing for tasks
        taskWhere.id = "__no_results__"
      }
    }

    const tasks = await prisma.task.findMany({
      where: taskWhere as any,
      include: { client: true, assignedEmployee: true },
      take: 5,
    })
    tasks.forEach((task) => {
      results.push({
        type: "TASK",
        id: task.id,
        title: task.title,
        subtitle: task.client?.name || "Unassigned",
        url: `/work-tracker`,
        icon: "CheckSquare",
        score: Math.max(
          fuzzyMatch(task.title, query),
          fuzzyMatch(task.description || "", query),
        ),
      })
    })
  }

  // Search Invoices (no role-based scoping — PARTNER/MANAGER/EXECUTIVE all see their clients' invoices)
  {
    const invoiceWhere: Record<string, unknown> = {
      OR: [
        { invoiceNumber: { contains: query, mode: "insensitive" } },
        { client: { name: { contains: query, mode: "insensitive" } } },
      ],
    }
    if (role === "EXECUTIVE" && executiveEmployeeId) {
      invoiceWhere.client = { assignedEmployeeId: executiveEmployeeId }
    }

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere as any,
      include: { client: true },
      take: 5,
    })
    invoices.forEach((invoice) => {
      results.push({
        type: "INVOICE",
        id: invoice.id,
        title: invoice.invoiceNumber,
        subtitle: invoice.client?.name || "Unknown",
        url: `/payments/invoices/${invoice.id}`,
        icon: "DollarSign",
        score: Math.max(
          fuzzyMatch(invoice.invoiceNumber, query),
          fuzzyMatch(invoice.client?.name || "", query),
        ),
      })
    })
  }

  // Search Documents
  {
    const docWhere: Record<string, unknown> = {
      OR: [{ title: { contains: query, mode: "insensitive" } }],
    }
    if (role === "EXECUTIVE" && executiveEmployeeId) {
      docWhere.client = { assignedEmployeeId: executiveEmployeeId }
    }

    const documents = await prisma.document.findMany({
      where: docWhere as any,
      include: { client: true },
      take: 5,
    })
    documents.forEach((doc) => {
      results.push({
        type: "DOCUMENT",
        id: doc.id,
        title: doc.title,
        subtitle: doc.category || "Document",
        url: `/documents`,
        icon: "FileText",
        score: fuzzyMatch(doc.title, query),
      })
    })
  }

  // Search Employees (PARTNER and MANAGER only)
  if (role === "PARTNER" || role === "MANAGER") {
    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { department: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
    })
    employees.forEach((employee) => {
      results.push({
        type: "EMPLOYEE",
        id: employee.id,
        title: employee.name,
        subtitle: employee.department || "Employee",
        url: `/employees/${employee.id}`,
        icon: "User",
        score: Math.max(
          fuzzyMatch(employee.name, query),
          fuzzyMatch(employee.email || "", query),
          fuzzyMatch(employee.department || "", query),
        ),
      })
    })
  }

  // Search Compliance Events
  {
    const compWhere: Record<string, unknown> = {
      title: { contains: query, mode: "insensitive" },
    }
    if (role === "EXECUTIVE" && executiveEmployeeId) {
      compWhere.client = { assignedEmployeeId: executiveEmployeeId }
    }

    const complianceEvents = await prisma.complianceEvent.findMany({
      where: compWhere as any,
      include: { client: true },
      take: 5,
    })
    complianceEvents.forEach((event) => {
      results.push({
        type: "COMPLIANCE",
        id: event.id,
        title: event.title,
        subtitle: event.client?.name || "Unknown",
        url: `/calendar`,
        icon: "Calendar",
        score: fuzzyMatch(event.title, query),
      })
    })
  }

  results.sort((a, b) => (b.score || 0) - (a.score || 0))
  return { results, user }
}

export async function getQuickCommands() {
  const session = await requireAuth()
  const role = session.user.role

  const commands = [
    { type: "NAVIGATION", id: "nav-dashboard", title: "Go to Dashboard", url: "/", icon: "LayoutDashboard" },
    { type: "NAVIGATION", id: "nav-clients", title: "Open Clients", url: "/clients", icon: "Users" },
    { type: "NAVIGATION", id: "nav-work-tracker", title: "Open Work Tracker", url: "/work-tracker", icon: "CheckSquare" },
    { type: "NAVIGATION", id: "nav-calendar", title: "Open Calendar", url: "/calendar", icon: "Calendar" },
    { type: "NAVIGATION", id: "nav-documents", title: "Open Documents", url: "/documents", icon: "FileText" },
    { type: "NAVIGATION", id: "nav-messaging", title: "Open Messaging", url: "/messaging", icon: "MessageSquare" },
    { type: "NAVIGATION", id: "nav-activity", title: "Open Activity Timeline", url: "/activity", icon: "Activity" },
  ]

  if (role === "PARTNER" || role === "MANAGER") {
    commands.push(
      { type: "ACTION", id: "action-create-client", title: "Create Client", url: "/clients/new", icon: "Plus" },
      { type: "ACTION", id: "action-create-task", title: "Create Task", url: "/work-tracker?create=true", icon: "Plus" },
      { type: "ACTION", id: "action-create-invoice", title: "Create Invoice", url: "/invoices/new", icon: "Plus" },
      { type: "ACTION", id: "action-upload-document", title: "Upload Document", url: "/documents/new", icon: "Upload" },
      { type: "ACTION", id: "action-add-employee", title: "Add Employee", url: "/employees/new", icon: "Plus" },
    )
  }

  return { commands, user: session.user }
}

// HIGH-01: requireAuth() so callers can only read their own history
export async function getSearchHistory(limit = 10) {
  const session = await requireAuth()
  const recentSearches = await prisma.activityLog.findMany({
    where: { entityType: "SEARCH", userId: session.user.id },
    orderBy: { timestamp: "desc" },
    take: limit,
    distinct: ["entityId"],
  })
  return recentSearches.map((log) => log.entityId as string)
}

// HIGH-01: requireAuth() and use session userId — no external userId parameter
export async function saveSearchHistory(query: string) {
  const session = await requireAuth()
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) return

  try {
    await prisma.activityLog.create({
      data: {
        entityType: "SEARCH_HISTORY",
        entityId: query.slice(0, MAX_QUERY_LENGTH),
        action: "SAVE_SEARCH",
        description: `Saved search`,
        userId: session.user.id,
        metadata: { timestamp: new Date().toISOString() },
      },
    })
  } catch {
    // non-critical
  }
}
