"use server"

import { requireAuth } from "@/lib/auth/guards"
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

// Improved fuzzy matching function with typo tolerance
function fuzzyMatch(text: string, query: string): number {
  if (!query) return 0
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100
  
  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 80
  
  // Contains query gets medium score
  if (lowerText.includes(lowerQuery)) return 60
  
  // Check for partial matches (character by character)
  let score = 0
  let queryIndex = 0
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10
      queryIndex++
    }
  }
  
  // Bonus if all characters matched
  if (queryIndex === lowerQuery.length) {
    score += 20
  }
  
  // Handle transpositions (swapped adjacent characters)
  if (score < 60 && lowerQuery.length >= 2) {
    for (let i = 0; i < lowerQuery.length - 1; i++) {
      const transposed = lowerQuery.slice(0, i) + lowerQuery[i + 1] + lowerQuery[i] + lowerQuery.slice(i + 2)
      if (lowerText.includes(transposed)) {
        score = Math.max(score, 50)
        break
      }
    }
  }
  
  // Handle missing characters (allow 1 missing character)
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

  const results: SearchResult[] = []

  // Log search analytics
  if (query.length >= 2) {
    try {
      await prisma.activityLog.create({
        data: {
          entityType: "SEARCH",
          entityId: query,
          action: "SEARCH",
          description: `User searched for: ${query}`,
          userId: user.id,
          userName: user.name,
          metadata: {
            query,
            role,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (error) {
      // Don't fail search if analytics fails
      console.error("Failed to log search analytics:", error)
    }
  }

  // Search Clients
  if (query.length >= 2) {
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { clientCode: { contains: query, mode: "insensitive" } },
          { gstin: { contains: query, mode: "insensitive" } },
          { pan: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
        ],
        ...(role === "EXECUTIVE" ? [{ assignedEmployeeId: user.id }] : []),
      },
      take: 5,
    })

    clients.forEach((client) => {
      const score = Math.max(
        fuzzyMatch(client.name, query),
        fuzzyMatch(client.clientCode, query),
        fuzzyMatch(client.gstin || "", query),
        fuzzyMatch(client.pan || "", query)
      )
      
      results.push({
        type: "CLIENT",
        id: client.id,
        title: client.name,
        subtitle: client.clientCode,
        url: `/clients/${client.id}`,
        icon: "Building2",
        score,
      })
    })
  }

  // Search Tasks
  if (query.length >= 2) {
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
        ...(role === "EXECUTIVE" ? [{ assignedEmployeeId: user.id }] : []),
      },
      include: {
        client: true,
        assignedEmployee: true,
      },
      take: 5,
    })

    tasks.forEach((task) => {
      const score = Math.max(
        fuzzyMatch(task.title, query),
        fuzzyMatch(task.description || "", query)
      )
      
      results.push({
        type: "TASK",
        id: task.id,
        title: task.title,
        subtitle: task.client?.name || "Unassigned",
        url: `/work-tracker`,
        icon: "CheckSquare",
        score,
      })
    })
  }

  // Search Invoices
  if (query.length >= 2) {
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: query, mode: "insensitive" } },
          { client: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: {
        client: true,
      },
      take: 5,
    })

    // Serialize Decimal objects to numbers for client components
    const serializedInvoices = invoices.map(invoice => ({
      ...invoice,
      amount: Number(invoice.amount),
      paidAmount: Number(invoice.paidAmount),
      outstandingAmount: Number(invoice.outstandingAmount),
    }))

    serializedInvoices.forEach((invoice) => {
      const score = Math.max(
        fuzzyMatch(invoice.invoiceNumber, query),
        fuzzyMatch(invoice.client?.name || "", query)
      )
      
      results.push({
        type: "INVOICE",
        id: invoice.id,
        title: invoice.invoiceNumber,
        subtitle: invoice.client?.name || "Unknown",
        url: `/invoices/${invoice.id}`,
        icon: "DollarSign",
        score,
      })
    })
  }

  // Search Documents
  if (query.length >= 2) {
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
        ],
      },
      include: {
        client: true,
      },
      take: 5,
    })

    documents.forEach((doc) => {
      const score = fuzzyMatch(doc.title, query)
      
      results.push({
        type: "DOCUMENT",
        id: doc.id,
        title: doc.title,
        subtitle: doc.category || "Document",
        url: `/documents`,
        icon: "FileText",
        score,
      })
    })
  }

  // Search Employees (PARTNER and MANAGER only)
  if (query.length >= 2 && (role === "PARTNER" || role === "MANAGER")) {
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
      const score = Math.max(
        fuzzyMatch(employee.name, query),
        fuzzyMatch(employee.email || "", query),
        fuzzyMatch(employee.department || "", query)
      )
      
      results.push({
        type: "EMPLOYEE",
        id: employee.id,
        title: employee.name,
        subtitle: employee.department || "Employee",
        url: `/employees/${employee.id}`,
        icon: "User",
        score,
      })
    })
  }

  // Search Compliance Events
  if (query.length >= 2) {
    const complianceEvents = await prisma.complianceEvent.findMany({
      where: {
        title: { contains: query, mode: "insensitive" },
      },
      include: {
        client: true,
      },
      take: 5,
    })

    complianceEvents.forEach((event) => {
      const score = fuzzyMatch(event.title, query)
      
      results.push({
        type: "COMPLIANCE",
        id: event.id,
        title: event.title,
        subtitle: event.client?.name || "Unknown",
        url: `/calendar`,
        icon: "Calendar",
        score,
      })
    })
  }

  // Sort results by score (highest first)
  results.sort((a, b) => (b.score || 0) - (a.score || 0))

  return {
    results,
    user,
  }
}

export async function getQuickCommands() {
  const session = await requireAuth()
  const role = session.user.role

  const commands = [
    // Navigation commands
    {
      type: "NAVIGATION",
      id: "nav-dashboard",
      title: "Go to Dashboard",
      url: "/",
      icon: "LayoutDashboard",
    },
    {
      type: "NAVIGATION",
      id: "nav-clients",
      title: "Open Clients",
      url: "/clients",
      icon: "Users",
    },
    {
      type: "NAVIGATION",
      id: "nav-work-tracker",
      title: "Open Work Tracker",
      url: "/work-tracker",
      icon: "CheckSquare",
    },
    {
      type: "NAVIGATION",
      id: "nav-calendar",
      title: "Open Calendar",
      url: "/calendar",
      icon: "Calendar",
    },
    {
      type: "NAVIGATION",
      id: "nav-documents",
      title: "Open Documents",
      url: "/documents",
      icon: "FileText",
    },
    {
      type: "NAVIGATION",
      id: "nav-messaging",
      title: "Open Messaging",
      url: "/messaging",
      icon: "MessageSquare",
    },
    {
      type: "NAVIGATION",
      id: "nav-activity",
      title: "Open Activity Timeline",
      url: "/activity",
      icon: "Activity",
    },
  ]

  // Action commands (PARTNER and MANAGER only)
  if (role === "PARTNER" || role === "MANAGER") {
    commands.push(
      {
        type: "ACTION",
        id: "action-create-client",
        title: "Create Client",
        url: "/clients/new",
        icon: "Plus",
      },
      {
        type: "ACTION",
        id: "action-create-task",
        title: "Create Task",
        url: "/work-tracker?create=true",
        icon: "Plus",
      },
      {
        type: "ACTION",
        id: "action-create-invoice",
        title: "Create Invoice",
        url: "/invoices/new",
        icon: "Plus",
      },
      {
        type: "ACTION",
        id: "action-upload-document",
        title: "Upload Document",
        url: "/documents/new",
        icon: "Upload",
      },
      {
        type: "ACTION",
        id: "action-add-employee",
        title: "Add Employee",
        url: "/employees/new",
        icon: "Plus",
      }
    )
  }

  return {
    commands,
    user: session.user,
  }
}

export async function getSearchHistory(userId: string, limit: number = 10) {
  const recentSearches = await prisma.activityLog.findMany({
    where: {
      entityType: "SEARCH",
      userId,
    },
    orderBy: {
      timestamp: "desc",
    },
    take: limit,
    distinct: ["entityId"],
  })

  return recentSearches.map((log) => log.entityId as string)
}

export async function saveSearchHistory(userId: string, query: string) {
  if (query.length < 2) return

  try {
    await prisma.activityLog.create({
      data: {
        entityType: "SEARCH_HISTORY",
        entityId: query,
        action: "SAVE_SEARCH",
        description: `Saved search: ${query}`,
        userId,
        metadata: {
          query,
          timestamp: new Date().toISOString(),
        },
      },
    })
  } catch (error) {
    console.error("Failed to save search history:", error)
  }
}
