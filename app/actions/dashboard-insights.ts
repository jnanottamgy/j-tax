"use server"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import type {
  Insight,
  InsightColumn,
  InsightMetric,
  InsightRow,
} from "@/lib/dashboard/insight-metrics"

/**
 * Dashboard drill-downs.
 *
 * Every Command Center tile is a single number. On its own that number is not
 * actionable — "High Risk Clients: 4" does not say which four, or why they are
 * risky. Each tile therefore resolves to the actual records behind it, with
 * enough context to act, plus an export.
 *
 * Metrics share one shape (columns + rows) so a single table and a single
 * export route serve all of them, while each metric still gets real columns
 * rather than a generic key/value dump.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

/** Whole days from `date` until now; negative means still in the future. */
function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function money(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v)
}

export async function getInsight(metric: InsightMetric): Promise<Insight> {
  await requirePartnerOrManager()

  switch (metric) {
    case "compliance":
      return complianceInsight()
    case "high-risk":
      return highRiskInsight()
    case "approvals":
      return approvalsInsight()
    case "pipeline":
      return pipelineInsight()
    case "leads":
      return leadsInsight()
    case "followups":
      return followUpsInsight()
    case "employees":
      return employeesInsight()
  }
}

// ─── Compliance ──────────────────────────────────────────────────────────────

/**
 * The score is completed ÷ (completed + pending). Showing the events themselves
 * explains a low score: which filings are still open, for whom, and how late.
 */
async function complianceInsight(): Promise<Insight> {
  const events = await prisma.complianceEvent.findMany({
    include: { client: { select: { id: true, name: true, clientCode: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 500,
  })

  const completed = events.filter((e) => e.status === "COMPLETED").length
  const pending = events.filter((e) => e.status === "PENDING").length
  const overdue = events.filter(
    (e) => e.status !== "COMPLETED" && e.status !== "CANCELLED" && e.dueDate < new Date()
  ).length

  const score =
    completed + pending > 0 ? Math.round((completed / (completed + pending)) * 100) : 100

  return {
    metric: "compliance",
    title: "Compliance Score",
    description:
      "Every statutory filing tracked for your clients. The score is completed filings as a share of completed plus pending.",
    summary: [
      { label: "Score", value: `${score}%` },
      { label: "Completed", value: String(completed) },
      { label: "Pending", value: String(pending) },
      { label: "Overdue", value: String(overdue) },
    ],
    columns: [
      { key: "client", label: "Client" },
      { key: "filing", label: "Filing" },
      { key: "type", label: "Type" },
      { key: "period", label: "Period" },
      { key: "dueDate", label: "Due", type: "date" },
      { key: "daysLate", label: "Days late", type: "danger" },
      { key: "workflow", label: "Stage" },
      { key: "status", label: "Status", type: "status" },
    ],
    rows: events.map((e) => {
      const late =
        e.status !== "COMPLETED" && e.status !== "CANCELLED" ? daysSince(e.dueDate) : null
      return {
        id: e.id,
        href: e.clientId ? `/clients/${e.clientId}` : undefined,
        cells: {
          client: e.client?.name ?? "Firm-wide",
          filing: e.title,
          type: e.type,
          period: e.filingPeriod ?? "—",
          dueDate: iso(e.dueDate),
          daysLate: late !== null && late > 0 ? late : null,
          workflow: e.workflowStatus.replace(/_/g, " "),
          status: e.status,
        },
      }
    }),
  }
}

// ─── High risk clients ───────────────────────────────────────────────────────

/**
 * The dashboard counts clients with 2+ overdue tasks. That count alone gives a
 * partner nothing to act on, so this lists each client with the reasons —
 * overdue tasks, overdue filings, and money outstanding.
 */
async function highRiskInsight(): Promise<Insight> {
  const now = new Date()

  const clients = await prisma.client.findMany({
    where: { status: { not: "INACTIVE" } },
    select: {
      id: true,
      name: true,
      clientCode: true,
      priority: true,
      assignedEmployeeName: true,
      tasks: {
        where: { dueDate: { lt: now }, status: { notIn: ["FILED_DONE"] } },
        select: { id: true, title: true, dueDate: true },
      },
      complianceEvents: {
        where: { dueDate: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: { id: true, title: true, dueDate: true },
      },
      invoices: {
        where: { outstandingAmount: { gt: 0 } },
        select: { outstandingAmount: true, dueDate: true },
      },
    },
    take: 500,
  })

  const scored = clients
    .map((c) => {
      const overdueTasks = c.tasks.length
      const overdueFilings = c.complianceEvents.length
      const outstanding = c.invoices.reduce((s, i) => s + money(i.outstandingAmount), 0)
      const overdueMoney = c.invoices
        .filter((i) => i.dueDate < now)
        .reduce((s, i) => s + money(i.outstandingAmount), 0)

      // Oldest unresolved item — the honest measure of how long this has slipped.
      const oldest = [...c.tasks, ...c.complianceEvents]
        .map((x) => x.dueDate)
        .filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime())[0]

      return { c, overdueTasks, overdueFilings, outstanding, overdueMoney, oldest }
    })
    // Same threshold the dashboard tile counts on, widened to include clients
    // that are risky for compliance or money reasons rather than tasks alone.
    .filter(
      (r) => r.overdueTasks >= 2 || r.overdueFilings >= 1 || r.overdueMoney > 0
    )
    .sort(
      (a, b) =>
        b.overdueTasks + b.overdueFilings - (a.overdueTasks + a.overdueFilings) ||
        b.overdueMoney - a.overdueMoney
    )

  return {
    metric: "high-risk",
    title: "High Risk Clients",
    description:
      "Clients carrying overdue work, missed filings, or unpaid invoices past their due date — and why each one is flagged.",
    summary: [
      { label: "Clients flagged", value: String(scored.length) },
      {
        label: "Overdue tasks",
        value: String(scored.reduce((s, r) => s + r.overdueTasks, 0)),
      },
      {
        label: "Overdue filings",
        value: String(scored.reduce((s, r) => s + r.overdueFilings, 0)),
      },
    ],
    columns: [
      { key: "client", label: "Client" },
      { key: "code", label: "Code" },
      { key: "owner", label: "Owner" },
      { key: "priority", label: "Priority" },
      { key: "overdueTasks", label: "Overdue tasks", type: "danger" },
      { key: "overdueFilings", label: "Overdue filings", type: "danger" },
      { key: "overdueMoney", label: "Overdue ₹", type: "currency" },
      { key: "outstanding", label: "Outstanding ₹", type: "currency" },
      { key: "slippedFor", label: "Slipped (days)", type: "danger" },
    ],
    rows: scored.map((r) => ({
      id: r.c.id,
      href: `/clients/${r.c.id}`,
      cells: {
        client: r.c.name,
        code: r.c.clientCode,
        owner: r.c.assignedEmployeeName ?? "Unassigned",
        priority: r.c.priority,
        overdueTasks: r.overdueTasks || null,
        overdueFilings: r.overdueFilings || null,
        overdueMoney: r.overdueMoney || null,
        outstanding: r.outstanding || null,
        slippedFor: daysSince(r.oldest ?? null),
      },
    })),
  }
}

// ─── Quotations awaiting approval ────────────────────────────────────────────

async function approvalsInsight(): Promise<Insight> {
  const quotations = await prisma.quotation.findMany({
    where: { status: "PENDING_APPROVAL" },
    orderBy: { createdAt: "asc" },
    include: { lead: { select: { name: true, source: true } } },
  })

  return {
    metric: "approvals",
    title: "Pending Approvals",
    description:
      "Quotations waiting on internal sign-off before they can be sent. Oldest first — these are blocking revenue.",
    summary: [
      { label: "Awaiting review", value: String(quotations.length) },
      {
        label: "Value held up",
        value: String(quotations.reduce((s, q) => s + money(q.total), 0)),
      },
    ],
    columns: [
      { key: "number", label: "Quotation" },
      { key: "client", label: "Client" },
      { key: "company", label: "Company" },
      { key: "total", label: "Value", type: "currency" },
      { key: "createdAt", label: "Raised", type: "date" },
      { key: "waitingDays", label: "Waiting (days)", type: "danger" },
      { key: "validUntil", label: "Valid until", type: "date" },
      { key: "createdBy", label: "Raised by" },
    ],
    rows: quotations.map((q) => ({
      id: q.id,
      href: `/proposals/quotations/${q.id}`,
      cells: {
        number: q.quotationNumber,
        client: q.clientName,
        company: q.clientCompany ?? "—",
        total: money(q.total),
        createdAt: iso(q.createdAt),
        waitingDays: daysSince(q.createdAt),
        validUntil: iso(q.validUntil),
        createdBy: q.createdBy,
      },
    })),
  }
}

// ─── Revenue pipeline ────────────────────────────────────────────────────────

async function pipelineInsight(): Promise<Insight> {
  const quotations = await prisma.quotation.findMany({
    where: { status: { in: ["SENT", "VIEWED"] } },
    orderBy: { sentAt: "desc" },
  })

  const now = new Date()
  const expiringSoon = quotations.filter(
    (q) => q.validUntil > now && q.validUntil.getTime() - now.getTime() < 7 * 86_400_000
  ).length

  return {
    metric: "pipeline",
    title: "Revenue Pipeline",
    description:
      "Quotations sent and awaiting the client's decision. This is money that converts only if it is followed up before it expires.",
    summary: [
      { label: "Live quotations", value: String(quotations.length) },
      {
        label: "Pipeline value",
        value: String(quotations.reduce((s, q) => s + money(q.total), 0)),
      },
      { label: "Expiring in 7 days", value: String(expiringSoon) },
    ],
    columns: [
      { key: "number", label: "Quotation" },
      { key: "client", label: "Client" },
      { key: "total", label: "Value", type: "currency" },
      { key: "status", label: "Status", type: "status" },
      { key: "sentAt", label: "Sent", type: "date" },
      { key: "pendingDays", label: "Pending (days)", type: "danger" },
      { key: "viewedAt", label: "Viewed", type: "date" },
      { key: "validUntil", label: "Expires", type: "date" },
    ],
    rows: quotations.map((q) => ({
      id: q.id,
      href: `/proposals/quotations/${q.id}`,
      cells: {
        number: q.quotationNumber,
        client: q.clientName,
        total: money(q.total),
        status: q.status,
        sentAt: iso(q.sentAt),
        pendingDays: daysSince(q.sentAt),
        viewedAt: iso(q.viewedAt),
        validUntil: iso(q.validUntil),
      },
    })),
  }
}

// ─── Leads ───────────────────────────────────────────────────────────────────

function leadColumns(): InsightColumn[] {
  return [
    { key: "name", label: "Lead" },
    { key: "company", label: "Company" },
    { key: "service", label: "Service wanted" },
    { key: "status", label: "Status", type: "status" },
    { key: "source", label: "Source" },
    { key: "value", label: "Est. value", type: "currency" },
    { key: "createdAt", label: "Created", type: "date" },
    { key: "ageDays", label: "Age (days)", type: "number" },
    { key: "contact", label: "Contact" },
  ]
}

function leadRow(l: {
  id: string
  name: string
  company: string | null
  serviceRequired: string | null
  status: string
  source: string
  estimatedValue: unknown
  createdAt: Date
  email: string
  phone: string | null
}): InsightRow {
  return {
    id: l.id,
    href: `/proposals/leads/${l.id}`,
    cells: {
      name: l.name,
      company: l.company ?? "—",
      service: l.serviceRequired ?? "—",
      status: l.status.replace(/_/g, " "),
      source: l.source.replace(/_/g, " "),
      value: money(l.estimatedValue) || null,
      createdAt: iso(l.createdAt),
      ageDays: daysSince(l.createdAt),
      contact: l.phone ? `${l.email} · ${l.phone}` : l.email,
    },
  }
}

async function leadsInsight(): Promise<Insight> {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } })
  const won = leads.filter((l) => l.status === "WON").length
  const lost = leads.filter((l) => l.status === "LOST").length
  const open = leads.length - won - lost

  return {
    metric: "leads",
    title: "Total Leads",
    description:
      "Every enquiry in the pipeline, newest first — where it came from, what they want, and how long it has been sitting.",
    summary: [
      { label: "Total", value: String(leads.length) },
      { label: "Open", value: String(open) },
      { label: "Won", value: String(won) },
      { label: "Lost", value: String(lost) },
    ],
    columns: leadColumns(),
    rows: leads.map(leadRow),
  }
}

async function followUpsInsight(): Promise<Insight> {
  const leads = await prisma.lead.findMany({
    where: {
      status: {
        in: ["FOLLOW_UP_REQUIRED", "CLIENT_WILL_REVERT", "CONTACTED", "NEGOTIATION"],
      },
    },
    orderBy: { updatedAt: "asc" },
  })

  return {
    metric: "followups",
    title: "Follow-Up Required",
    description:
      "Leads waiting on a call back from you. Ordered by longest untouched — the top of this list is what goes cold first.",
    summary: [
      { label: "Needing attention", value: String(leads.length) },
      {
        label: "Value at stake",
        value: String(leads.reduce((s, l) => s + money(l.estimatedValue), 0)),
      },
    ],
    columns: leadColumns(),
    rows: leads.map(leadRow),
  }
}

// ─── Employees ───────────────────────────────────────────────────────────────

/** Active staff with the workload each is actually carrying. */
async function employeesInsight(): Promise<Insight> {
  const now = new Date()

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      createdAt: true,
      _count: { select: { clients: true } },
      tasks: {
        where: { status: { notIn: ["FILED_DONE"] } },
        select: { id: true, dueDate: true, acceptanceStatus: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const rows = employees.map((e) => {
    const open = e.tasks.length
    const overdue = e.tasks.filter((t) => t.dueDate && t.dueDate < now).length
    const unaccepted = e.tasks.filter((t) => t.acceptanceStatus === "PENDING").length
    return { e, open, overdue, unaccepted }
  })

  return {
    metric: "employees",
    title: "Active Employees",
    description:
      "Your team and the load each person is carrying right now — clients owned, open tasks, and anything already overdue.",
    summary: [
      { label: "Active staff", value: String(employees.length) },
      { label: "Open tasks", value: String(rows.reduce((s, r) => s + r.open, 0)) },
      { label: "Overdue tasks", value: String(rows.reduce((s, r) => s + r.overdue, 0)) },
    ],
    columns: [
      { key: "name", label: "Employee" },
      { key: "department", label: "Department" },
      { key: "email", label: "Email" },
      { key: "clients", label: "Clients", type: "number" },
      { key: "openTasks", label: "Open tasks", type: "number" },
      { key: "overdueTasks", label: "Overdue", type: "danger" },
      { key: "unaccepted", label: "Not accepted", type: "danger" },
      { key: "since", label: "Joined", type: "date" },
    ],
    rows: rows.map((r) => ({
      id: r.e.id,
      href: `/workforce/${r.e.id}`,
      cells: {
        name: r.e.name,
        department: r.e.department ?? "—",
        email: r.e.email,
        clients: r.e._count.clients,
        openTasks: r.open,
        overdueTasks: r.overdue || null,
        unaccepted: r.unaccepted || null,
        since: iso(r.e.createdAt),
      },
    })),
  }
}
