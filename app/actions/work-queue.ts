"use server"

import { requireAuth } from "@/lib/auth/guards"
import { getExecutiveEmployeeId } from "@/lib/auth/scope"
import { prisma } from "@/lib/prisma"

/**
 * "What needs me right now" — the queues that make the task state machine
 * actionable.
 *
 * The workflow already models handoffs properly: an assignment waits to be
 * accepted, an employee can only push work to UNDER_REVIEW, a decline bounces
 * back with a reason, and a blocked task refuses to move. What was missing was
 * anywhere to SEE the resulting states. Every handoff fired a notification and
 * then relied on someone catching it before it scrolled away — so a declined
 * task (whose own code comment says "manager must reassign") had no queue to be
 * reassigned from, and work sat in review with nobody prompted to review it.
 *
 * Queues are role-shaped: an employee sees what is on their desk, a
 * partner/manager sees what is waiting on them or has stalled.
 */

export type QueueTone = "urgent" | "attention" | "info"

export type QueueItem = {
  id: string
  title: string
  subtitle: string
  meta: string | null
  href: string
}

export type WorkQueue = {
  key: string
  label: string
  /** Why this queue matters — shown when it is empty, so silence reads as good news. */
  emptyText: string
  tone: QueueTone
  items: QueueItem[]
  total: number
}

const MAX_PER_QUEUE = 8

function daysAgo(d: Date | null | undefined): number | null {
  if (!d) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function overdueLabel(due: Date | null | undefined): string | null {
  const days = daysAgo(due)
  if (days === null || days <= 0) return null
  return `${days}d overdue`
}

export async function getWorkQueue(): Promise<WorkQueue[]> {
  const session = await requireAuth()
  const role = session.user.role
  const employeeId = await getExecutiveEmployeeId(session)
  const now = new Date()

  const taskSelect = {
    id: true,
    title: true,
    dueDate: true,
    declinedReason: true,
    declinedAt: true,
    createdAt: true,
    updatedAt: true,
    client: { select: { name: true } },
    assignedEmployee: { select: { name: true } },
  } as const

  const item = (
    t: {
      id: string
      title: string
      client: { name: string } | null
      assignedEmployee?: { name: string } | null
    },
    meta: string | null
  ): QueueItem => ({
    id: t.id,
    title: t.title,
    subtitle: t.client?.name ?? "No client",
    meta,
    href: `/work-tracker?taskId=${t.id}`,
  })

  // ── Employee: what is on my desk ──────────────────────────────────────────
  if (role === "EMPLOYEE") {
    // An employee with no linked Employee record owns nothing — return empty
    // rather than falling through to an unfiltered query.
    if (!employeeId) return []

    const [pending, blocked, overdue] = await Promise.all([
      prisma.task.findMany({
        where: { assignedEmployeeId: employeeId, acceptanceStatus: "PENDING" },
        select: taskSelect,
        orderBy: { createdAt: "asc" },
        take: MAX_PER_QUEUE,
      }),
      prisma.task.findMany({
        where: {
          assignedEmployeeId: employeeId,
          acceptanceStatus: "ACCEPTED",
          status: { notIn: ["FILED_DONE"] },
          blockedBy: { some: { blocker: { status: { not: "FILED_DONE" } } } },
        },
        select: taskSelect,
        orderBy: { dueDate: "asc" },
        take: MAX_PER_QUEUE,
      }),
      prisma.task.findMany({
        where: {
          assignedEmployeeId: employeeId,
          status: { notIn: ["FILED_DONE"] },
          dueDate: { lt: now },
        },
        select: taskSelect,
        orderBy: { dueDate: "asc" },
        take: MAX_PER_QUEUE,
      }),
    ])

    const employeeQueues: WorkQueue[] = [
      {
        key: "accept",
        label: "Waiting for you to accept",
        emptyText: "No new assignments waiting.",
        tone: "attention",
        items: pending.map((t) => item(t, `assigned ${daysAgo(t.createdAt) ?? 0}d ago`)),
        total: pending.length,
      },
      {
        key: "overdue",
        label: "Past their due date",
        emptyText: "Nothing overdue — you're on top of it.",
        tone: "urgent",
        items: overdue.map((t) => item(t, overdueLabel(t.dueDate))),
        total: overdue.length,
      },
      {
        key: "blocked",
        label: "Blocked by other work",
        emptyText: "Nothing is waiting on someone else.",
        tone: "info",
        items: blocked.map((t) => item(t, "waiting on a blocker")),
        total: blocked.length,
      },
    ]
    return employeeQueues.filter((q) => q.items.length > 0 || q.key === "accept")
  }

  // ── Partner / Manager: what is waiting on me, or has stalled ──────────────
  const [review, declined, unassigned, unaccepted, orphaned, heldInvoices] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: "UNDER_REVIEW",
        // Separation of duties: a Manager cannot sign off work assigned to
        // themselves, so listing it under "Awaiting your review" would offer an
        // action they are blocked from taking. It sits in the Partner's queue
        // instead, which is where it actually needs to go.
        ...(role === "MANAGER" && employeeId
          ? { assignedEmployeeId: { not: employeeId } }
          : {}),
      },
      select: taskSelect,
      orderBy: { updatedAt: "asc" },
      take: MAX_PER_QUEUE,
    }),
    prisma.task.findMany({
      where: { acceptanceStatus: "DECLINED", status: { notIn: ["FILED_DONE"] } },
      select: taskSelect,
      orderBy: { declinedAt: "desc" },
      take: MAX_PER_QUEUE,
    }),
    prisma.task.findMany({
      where: { assignedEmployeeId: null, status: { notIn: ["FILED_DONE"] } },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: MAX_PER_QUEUE,
    }),
    // Assigned but still unacknowledged after two working days — the quiet
    // failure mode, where everyone assumes the work has started.
    prisma.task.findMany({
      where: {
        acceptanceStatus: "PENDING",
        assignedEmployeeId: { not: null },
        createdAt: { lt: new Date(now.getTime() - 2 * 86_400_000) },
        status: { notIn: ["FILED_DONE"] },
      },
      select: taskSelect,
      orderBy: { createdAt: "asc" },
      take: MAX_PER_QUEUE,
    }),
    // Assigned to someone who can no longer log in. Disabling a team member
    // locked their account but left their work on it — and because the work IS
    // assigned, the "Nobody assigned" queue never caught it, so it went quiet
    // rather than becoming somebody's problem.
    prisma.task.findMany({
      where: {
        status: { notIn: ["FILED_DONE"] },
        assignedEmployee: { isActive: false },
      },
      select: taskSelect,
      orderBy: { dueDate: "asc" },
      take: MAX_PER_QUEUE,
    }),
    // Money that cannot leave the firm until a Partner signs it off.
    prisma.invoice
      .findMany({
        where: { requiresApproval: true, approvedAt: null, deletedAt: null },
        select: {
          id: true,
          invoiceNumber: true,
          amount: true,
          serviceDescription: true,
          client: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: MAX_PER_QUEUE,
      })
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          amount: Number(r.amount),
          serviceDescription: r.serviceDescription,
          clientName: r.client?.name ?? "Unknown client",
        }))
      ),
  ])

  const managerQueues: WorkQueue[] = [
    {
      key: "review",
      label: "Awaiting your review",
      emptyText: "Nothing waiting on your sign-off.",
      tone: "attention",
      items: review.map((t) =>
        item(t, `${t.assignedEmployee?.name ?? "Unassigned"} · ${daysAgo(t.updatedAt) ?? 0}d`)
      ),
      total: review.length,
    },
    {
      key: "declined",
      label: "Declined — needs reassigning",
      emptyText: "No declined assignments.",
      tone: "urgent",
      items: declined.map((t) =>
        item(
          t,
          t.declinedReason
            ? `${t.assignedEmployee?.name ?? "—"}: ${t.declinedReason.slice(0, 60)}`
            : (t.assignedEmployee?.name ?? null)
        )
      ),
      total: declined.length,
    },
    {
      key: "unaccepted",
      label: "Assigned but not accepted",
      emptyText: "Every assignment has been acknowledged.",
      tone: "info",
      items: unaccepted.map((t) =>
        item(t, `${t.assignedEmployee?.name ?? "—"} · ${daysAgo(t.createdAt) ?? 0}d silent`)
      ),
      total: unaccepted.length,
    },
    {
      key: "unassigned",
      label: "Nobody assigned",
      emptyText: "All open work has an owner.",
      tone: "urgent",
      items: unassigned.map((t) => item(t, overdueLabel(t.dueDate))),
      total: unassigned.length,
    },
    {
      key: "orphaned",
      label: "Owner has been deactivated",
      emptyText: "No work is stranded on a disabled account.",
      tone: "urgent",
      items: orphaned.map((t) =>
        item(t, `${t.assignedEmployee?.name ?? "—"} · no longer active`)
      ),
      total: orphaned.length,
    },
    {
      key: "invoice-approval",
      label: role === "PARTNER" ? "Invoices needing your approval" : "Invoices held for approval",
      emptyText: "No invoices are waiting on a signature.",
      tone: "attention",
      items: heldInvoices.map((inv) => ({
        id: inv.id,
        title: `${inv.invoiceNumber} · ₹${inv.amount.toLocaleString("en-IN")}`,
        subtitle: inv.clientName,
        meta: inv.serviceDescription,
        href: `/payments/invoices/${inv.id}`,
      })),
      total: heldInvoices.length,
    },
  ]
  return managerQueues.filter((q) => q.items.length > 0 || q.key === "review")
}
