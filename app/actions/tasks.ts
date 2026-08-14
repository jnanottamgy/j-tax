"use server"

import { revalidatePath } from "next/cache"
import { toUserError } from "@/lib/forms/errors"
import { z } from "zod"

import {
  requireAuth,
  requirePartnerOrManager,
} from "@/lib/auth/guards"
import {
  canAccessAssignedTask,
  getExecutiveEmployeeId,
  taskFirmFilter,
} from "@/lib/auth/scope"
import type { FormActionState } from "@/lib/forms/types"
import { canSignOffTask } from "@/lib/auth/delegation"
import { prisma } from "@/lib/prisma"
import { notifyRoles, notifyUser } from "@/lib/notifications/notify"
import { parseCreateTaskFormData, taskBaseSchema } from "@/lib/validations/task"
import { dueWindowPrismaFilter, type DueWindow } from "@/lib/filters/due-window"
import { recordTimelineEvent } from "@/lib/timeline/events"
import { checkAssignment, type AssignmentConcern } from "@/lib/tasks/assignment"
import {
  canTransition,
  deriveTaskFlags,
  isDeclineReason,
  isTaskStatus,
  requiresReason,
  type TaskStatus as TaskStatusValue,
} from "@/lib/tasks/transitions"

export type TaskActionState = FormActionState

const taskSchema = taskBaseSchema

export async function getTasksData(filters?: {
  status?: string
  priority?: string
  assignedEmployeeId?: string
  search?: string
  serviceType?: string
  /** Slice by when the work is due rather than by how it is progressing. */
  dueWindow?: DueWindow
}) {
  const session = await requireAuth()
  const executiveEmployeeId = await getExecutiveEmployeeId(session)

  const where: any = {}
  
  if (filters?.status) {
    where.status = filters.status
  }
  
  if (filters?.priority) {
    where.priority = filters.priority
  }
  
  if (filters?.assignedEmployeeId) {
    where.assignedEmployeeId = filters.assignedEmployeeId
  }
  
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { remarks: { contains: filters.search, mode: "insensitive" } },
    ]
  }
  
  if (filters?.serviceType) {
    where.serviceType = filters.serviceType
  }

  // Due-date windows. NO_DATE is not a range — a task with no due date is a
  // real category (and worth finding, since nothing will ever chase it), so it
  // is expressed as a null check rather than a bound.
  if (filters?.dueWindow) {
    const range = dueWindowPrismaFilter(filters.dueWindow, new Date())
    where.dueDate = range === null ? null : range
  }
  
  if (executiveEmployeeId) {
    where.assignedEmployeeId = executiveEmployeeId
  } else if (session.user.role === "EMPLOYEE") {
    return { tasks: [], employees: [], user: session.user }
  }
  
  const tasks = await prisma.task.findMany({
    where,
    include: {
      client: true,
      assignedEmployee: true,
      comments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      blockedBy: {
        include: { blocker: { select: { id: true, title: true, status: true } } },
      },
      _count: {
        select: {
          comments: true,
          attachments: true,
        },
      },
    },
    orderBy: [
      { priority: "desc" },
      { dueDate: "asc" },
      { createdAt: "desc" },
    ],
  })
  
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  })
  
  return { tasks, employees, user: session.user }
}

export async function createTask(
  _prevState: TaskActionState,
  formData: FormData
): Promise<TaskActionState> {
  try {
    const session = await requirePartnerOrManager()

    const parsed = parseCreateTaskFormData(formData)

    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    const {
      clientId,
      description,
      assignedEmployeeId,
      dueDate,
      completionDate,
      ...taskFields
    } = parsed.data

    // Default the assignee to whoever owns the client.
    //
    // The compliance engine already routes generated filings this way; ad-hoc
    // tasks made you pick, every time, for a client whose owner the app already
    // knows. An explicit choice always wins — this only fills a blank.
    let resolvedAssignee = assignedEmployeeId?.trim() || null
    if (!resolvedAssignee) {
      const owner = await prisma.client.findUnique({
        where: { id: clientId },
        select: { assignedEmployeeId: true },
      })
      resolvedAssignee = owner?.assignedEmployeeId ?? null
    }

    const willAssign = Boolean(resolvedAssignee)
    const newTask = await prisma.task.create({
      data: {
        ...taskFields,
        clientId,
        description: description?.trim() ? description : null,
        assignedEmployeeId: resolvedAssignee,
        // Assigned tasks await the employee's acceptance; unassigned start ACCEPTED.
        acceptanceStatus: willAssign ? "PENDING" : "ACCEPTED",
        dueDate: dueDate ? new Date(dueDate) : null,
        completionDate: completionDate ? new Date(completionDate) : null,
      },
      include: { client: { select: { name: true } } },
    })

    // Timeline event
    await recordTimelineEvent({
      clientId: newTask.clientId,
      eventType: "TASK_CREATED",
      title: `Task created: ${newTask.title}`,
      description: newTask.description || null,
      performedBy: session.user.id,
    })

    // Workforce tracking
    try {
      const { trackEmployeeActivity, getEmployeeByUserId } = await import("@/lib/workforce/tracker")
      const employee = await getEmployeeByUserId(session.user.id)
      if (employee) {
        await trackEmployeeActivity({
          employeeId: employee.id,
          userId: session.user.id,
          activityType: "TASK_CREATED",
          description: `Created task "${newTask.title}" for ${newTask.client.name}`,
          entityType: "TASK",
          entityId: newTask.id,
          entityName: newTask.title,
        })
      }
    } catch (logErr) { console.error("activity/notification log failed:", logErr) }

    // In-app notification for the assigned employee
    if (newTask.assignedEmployeeId) {
      try {
        const assignedEmployee = await prisma.employee.findUnique({
          where: { id: newTask.assignedEmployeeId },
          select: { userId: true },
        })
        if (assignedEmployee?.userId) {
          await prisma.notification.create({
            data: {
              userId: assignedEmployee.userId,
              title: "New Task Assigned",
              message: `You have been assigned: "${newTask.title}" for ${newTask.client.name}`,
              type: "TASK_ASSIGNED",
              entityType: "TASK",
              entityId: newTask.id,
            },
          })
        }
      } catch (logErr) { console.error("activity/notification log failed:", logErr) }
    }

    revalidatePath("/work-tracker")
    revalidatePath(`/clients/${newTask.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to create tasks." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to create task. Please try again." }
  }
}

export async function updateTask(
  _prevState: TaskActionState,
  formData: FormData
): Promise<TaskActionState> {
  try {
    // Full task edits (title, due date, priority, assignee, completion date)
    // are management actions. Employees work their tasks through status
    // updates (review-gated), comments, attachments, and the timer — they
    // don't get to re-negotiate scope or deadlines on assigned work.
    await requirePartnerOrManager()

    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return { error: "Missing task id" }
    }

    const task = await prisma.task.findUnique({
      where: { id },
    })

    if (!task) {
      return { error: "Task not found" }
    }

    const raw = {
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      status: formData.get("status"),
      priority: formData.get("priority"),
      dueDate: formData.get("dueDate") || undefined,
      completionDate: formData.get("completionDate") || undefined,
      serviceType: formData.get("serviceType") || undefined,
      assignedEmployeeId: formData.get("assignedEmployeeId") || undefined,
      remarks: formData.get("remarks") || undefined,
    }

    const parsed = taskSchema.safeParse(raw)

    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    // Reassignment resets the acceptance workflow: the new assignee must accept.
    const newAssignee = parsed.data.assignedEmployeeId?.trim() || null
    const reassigned = newAssignee !== (task.assignedEmployeeId ?? null)
    const acceptanceReset = reassigned
      ? {
          acceptanceStatus: (newAssignee ? "PENDING" : "ACCEPTED") as "PENDING" | "ACCEPTED",
          acceptedAt: null,
          declinedAt: null,
          declinedReason: null,
        }
      : {}

    // Moving the due date has to move the overdue flag with it. Nothing ever
    // cleared it, so extending a deadline left the task marked late for ever
    // and every workload report kept counting it.
    const newDueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
    const flags = deriveTaskFlags({
      status: task.status as TaskStatusValue,
      dueDate: newDueDate,
      now: new Date(),
      existingCompletionDate: parsed.data.completionDate
        ? new Date(parsed.data.completionDate)
        : task.completionDate,
    })

    await prisma.task.update({
      where: { id },
      data: {
        ...parsed.data,
        ...acceptanceReset,
        dueDate: newDueDate,
        completionDate: flags.completionDate,
        isOverdue: flags.isOverdue,
        escalated: flags.escalated,
        escalationLevel: flags.escalationLevel,
      },
    })

    // Notify the newly-assigned employee so they can accept/decline.
    if (reassigned && newAssignee) {
      try {
        const emp = await prisma.employee.findUnique({
          where: { id: newAssignee },
          select: { userId: true },
        })
        if (emp?.userId) {
          await prisma.notification.create({
            data: {
              userId: emp.userId,
              title: "New Task Assigned",
              message: `You have been assigned: "${parsed.data.title}". Please accept or decline it.`,
              type: "TASK_ASSIGNED",
              entityType: "TASK",
              entityId: id,
            },
          })
        }
      } catch (e) { console.error("reassign notify failed:", e) }
    }

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${id}`)
    revalidatePath(`/clients/${task.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to edit this task." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to update task. Please try again." }
  }
}

/** Employee accepts an assigned task — starts the days-worked clock. */
export async function acceptTask(taskId: string): Promise<TaskActionState> {
  try {
    const session = await requireAuth()
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { client: { select: { name: true } } },
    })
    if (!task) return { error: "Task not found" }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only accept tasks assigned to you" }
    }
    if (task.acceptanceStatus === "ACCEPTED") return { success: true }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        acceptanceStatus: "ACCEPTED",
        // Anchor the day-counter at FIRST acceptance only.
        acceptedAt: task.acceptedAt ?? new Date(),
        declinedAt: null,
        declinedReason: null,
      },
    })

    await notifyRoles(
      ["PARTNER", "MANAGER"],
      {
        title: "Task accepted",
        message: `${session.user.name} accepted "${task.title}" (${task.client.name}).`,
        type: "INFO",
        entityType: "TASK",
        entityId: taskId,
      },
      { excludeUserId: session.user.id }
    )

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${taskId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

/** Employee declines an assigned task with a reason — manager must reassign. */
export async function declineTask(
  taskId: string,
  reason: string,
  reasonCode?: string
): Promise<TaskActionState> {
  try {
    const session = await requireAuth()
    if (!reason?.trim()) {
      return { fieldErrors: { reason: ["Please give a reason for declining."] } }
    }
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { client: { select: { name: true } } },
    })
    if (!task) return { error: "Task not found" }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only decline tasks assigned to you" }
    }

    // Declining releases the task.
    //
    // It used to leave assignedEmployeeId untouched, so a refused task stayed
    // on the decliner's plate — counted in their workload and capacity, shown
    // on their board, and simultaneously blocked: every status change came back
    // with "you declined this task, a manager needs to reassign it". Because it
    // was still assigned it never reached the unassigned queue either, so if
    // the one notification was missed the work sat in limbo owned by somebody
    // who had refused it. Unassigning puts it back where it can be picked up.
    await prisma.task.update({
      where: { id: taskId },
      data: {
        acceptanceStatus: "DECLINED",
        declinedAt: new Date(),
        declinedReason: reason.trim(),
        declinedReasonCode: reasonCode && isDeclineReason(reasonCode) ? reasonCode : "OTHER",
        declinedByEmployeeId: executiveEmployeeId,
        assignedEmployeeId: null,
        acceptedAt: null,
      },
    })

    await notifyRoles(
      ["PARTNER", "MANAGER"],
      {
        title: "Task declined — now unassigned",
        message: `${session.user.name} declined "${task.title}" (${task.client.name}): ${reason.trim()}. It is back in the unassigned queue.`,
        type: "WARNING",
        entityType: "TASK",
        entityId: taskId,
      },
      { excludeUserId: session.user.id }
    )

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${taskId}`)
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  /** Required when sending work back or reopening something already filed. */
  reason?: string
): Promise<TaskActionState> {
  try {
    const session = await requireAuth()

    // The one status writer in the app used to take a bare string and hand it
    // straight to Prisma, so a bad value surfaced as a raw enum error.
    if (!isTaskStatus(status)) {
      return { error: "That is not a valid status." }
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      return { error: "Task not found" }
    }

    const transition = canTransition(task.status as TaskStatusValue, status)
    if (!transition.allowed) return { error: transition.reason }

    // Sending work back, or reopening something already filed, has to say why.
    // "Check the task comments" with no comment is the most common complaint
    // about review workflows, and nothing required one.
    if (requiresReason(task.status as TaskStatusValue, status) && !reason?.trim()) {
      return {
        fieldErrors: {
          reason: [
            task.status === "FILED_DONE"
              ? "Say why this filed task is being reopened."
              : "Say what needs changing — the assignee only sees this.",
          ],
        },
      }
    }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only update tasks assigned to you" }
    }

    // Acceptance gate — an employee must accept a task before working on it.
    if (session.user.role === "EMPLOYEE" && task.acceptanceStatus !== "ACCEPTED") {
      return {
        error:
          task.acceptanceStatus === "DECLINED"
            ? "You declined this task — a manager needs to reassign it."
            : "Accept this task before updating its status.",
      }
    }

    // Review gate + separation of duties. Nobody signs off their own filing —
    // see lib/auth/delegation.ts for why a Partner is the one exception.
    if (status === "FILED_DONE") {
      const verdict = canSignOffTask({
        role: session.user.role,
        actorEmployeeId: executiveEmployeeId,
        assignedEmployeeId: task.assignedEmployeeId,
      })
      if (!verdict.allowed) return { error: verdict.reason }
    }

    // Dependency guard — a task with open blockers cannot move forward.
    // (Moving back to NOT_STARTED / ON_HOLD / DATA_AWAITED is always allowed.)
    if (["IN_PROGRESS", "UNDER_REVIEW", "FILED_DONE"].includes(status)) {
      const openBlockers = await prisma.taskDependency.findMany({
        where: { taskId, blocker: { status: { not: "FILED_DONE" } } },
        include: { blocker: { select: { title: true } } },
      })
      if (openBlockers.length > 0) {
        const titles = openBlockers.map((d) => `"${d.blocker.title}"`).join(", ")
        return {
          error: `Blocked by ${titles} — complete ${openBlockers.length === 1 ? "it" : "them"} first, or remove the dependency.`,
        }
      }
    }

    // Flags derived, not toggled.
    //
    // `isOverdue` was set true by a nightly cron and never once set back —
    // there was no `isOverdue: false` write anywhere in the codebase — so
    // finishing a task or moving its due date left the flag on for ever and
    // every workload count that read it grew wrong week by week. `escalated`
    // was one-way too, so a task escalated once could never escalate again.
    // And `completionDate` was written only when absent and never cleared, so
    // a reopened task read as complete while sitting in an open status.
    const flags = deriveTaskFlags({
      status,
      dueDate: task.dueDate,
      now: new Date(),
      existingCompletionDate: task.completionDate,
    })

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        isOverdue: flags.isOverdue,
        completionDate: flags.completionDate,
        escalated: flags.escalated,
        escalationLevel: flags.escalationLevel,
      },
    })

    // A reason given on a send-back or a reopen belongs on the task, where the
    // assignee will actually look, not only in a notification they may miss.
    if (reason?.trim()) {
      await prisma.taskComment.create({
        data: {
          taskId,
          userId: session.user.id,
          // Prefixed so the comment reads as a decision rather than a remark
          // once it is sitting in the thread months later.
          content:
            task.status === "FILED_DONE"
              ? `Reopened by ${session.user.name}: ${reason.trim()}`
              : `Sent back by ${session.user.name}: ${reason.trim()}`,
        },
      }).catch(() => { /* the status change is what matters */ })
    }

    // Task completed → tell the management team so an invoice can be raised.
    if (status === "FILED_DONE" && task.status !== "FILED_DONE") {
      const client = await prisma.client.findUnique({
        where: { id: task.clientId },
        select: { name: true },
      })
      await notifyRoles(
        ["PARTNER", "MANAGER"],
        {
          title: `Task completed — ready to invoice: ${task.title}`,
          message: `"${task.title}"${client ? ` (${client.name})` : ""} is done. Create an invoice for the work.`,
          type: "INFO",
          entityType: "TASK",
          entityId: taskId,
        },
        { excludeUserId: session.user.id }
      )
    }

    // ── Review-flow notifications (the Employee ↔ Manager reporting chain) ──
    // Employee submits → every Manager/Partner is told there's work to review.
    if (status === "UNDER_REVIEW" && session.user.role === "EMPLOYEE") {
      const client = await prisma.client.findUnique({
        where: { id: task.clientId },
        select: { name: true },
      })
      const payload = {
        title: `Ready for review: ${task.title}`,
        message: `${session.user.name} submitted "${task.title}"${client ? ` (${client.name})` : ""} for sign-off.`,
        type: "INFO" as const,
        entityType: "TASK" as const,
        entityId: taskId,
      }

      // A named reviewer gets it personally. Shouting at every Manager and
      // Partner is how work sat unreviewed — each of them assumed one of the
      // others had picked it up.
      const reviewer = task.reviewerEmployeeId
        ? await prisma.employee.findUnique({
            where: { id: task.reviewerEmployeeId },
            select: { userId: true },
          })
        : null

      if (reviewer?.userId) {
        await notifyUser(reviewer.userId, payload)
      } else {
        await notifyRoles(["PARTNER", "MANAGER"], payload)
      }
    }
    // Reviewer decides → the assignee hears back (approved or sent back).
    if (
      task.status === "UNDER_REVIEW" &&
      status !== "UNDER_REVIEW" &&
      session.user.role !== "EMPLOYEE" &&
      task.assignedEmployeeId
    ) {
      const assignee = await prisma.employee.findUnique({
        where: { id: task.assignedEmployeeId },
        select: { userId: true },
      })
      if (assignee?.userId && assignee.userId !== session.user.id) {
        await notifyUser(
          assignee.userId,
          status === "FILED_DONE"
            ? {
                title: `Signed off: ${task.title}`,
                message: `${session.user.name} approved and filed "${task.title}".`,
                type: "INFO",
                entityType: "TASK",
                entityId: taskId,
              }
            : {
                title: `Sent back: ${task.title}`,
                message: `${session.user.name} moved "${task.title}" from Under Review to ${status.replace(/_/g, " ").toLowerCase()} — check the task comments.`,
                type: "WARNING",
                entityType: "TASK",
                entityId: taskId,
              }
        )
      }
    }

    // Timeline event on completion
    if (status === "FILED_DONE") {
      await recordTimelineEvent({
        clientId: task.clientId,
        eventType: "TASK_COMPLETED",
        title: `Task completed: ${task.title}`,
        performedBy: session.user.id,
      })
    }

    // Workforce tracking
    if (status === "FILED_DONE") {
      try {
        const { trackEmployeeActivity, getEmployeeByUserId } = await import("@/lib/workforce/tracker")
        const employee = await getEmployeeByUserId(session.user.id)
        if (employee) {
          await trackEmployeeActivity({
            employeeId: employee.id,
            userId: session.user.id,
            activityType: "TASK_COMPLETED",
            description: `Completed task "${task.title}"`,
            entityType: "TASK",
            entityId: taskId,
            entityName: task.title,
          })
        }
      } catch (logErr) { console.error("activity/notification log failed:", logErr) }

      // Notify assignees of tasks this completion just unblocked
      try {
        const dependents = await prisma.taskDependency.findMany({
          where: { blockerId: taskId },
          include: {
            task: {
              include: {
                assignedEmployee: { select: { userId: true } },
                blockedBy: {
                  include: { blocker: { select: { id: true, status: true } } },
                },
              },
            },
          },
        })
        for (const dep of dependents) {
          const stillBlocked = dep.task.blockedBy.some(
            (d) => d.blocker.id !== taskId && d.blocker.status !== "FILED_DONE"
          )
          const userId = dep.task.assignedEmployee?.userId
          if (!stillBlocked && userId) {
            await prisma.notification.create({
              data: {
                userId,
                title: `Task unblocked: ${dep.task.title}`,
                message: `"${task.title}" is done — "${dep.task.title}" is no longer waiting on anything.`,
                type: "INFO",
                entityType: "TASK",
                entityId: dep.task.id,
              },
            })
          }
        }
      } catch (logErr) { console.error("unblock notification failed:", logErr) }
    }

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${taskId}`)
    revalidatePath(`/clients/${task.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to update task status. Please try again." }
  }
}

export async function deleteTask(taskId: string): Promise<TaskActionState> {
  try {
    await requirePartnerOrManager()

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) return { error: "Task not found." }

    await prisma.task.delete({ where: { id: taskId } })

    revalidatePath("/work-tracker")
    revalidatePath(`/clients/${task.clientId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to delete tasks." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to delete task. Please try again." }
  }
}

export async function getTaskDetail(taskId: string) {
  const session = await requireAuth()
  
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      client: true,
      assignedEmployee: true,
      comments: {
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
      },
      automations: {
        where: { isActive: true },
      },
      blockedBy: {
        include: { blocker: { select: { id: true, title: true, status: true } } },
      },
      blocking: {
        include: { task: { select: { id: true, title: true, status: true } } },
      },
    },
  })

  if (!task) {
    throw new Error("Task not found")
  }

  const executiveEmployeeId = await getExecutiveEmployeeId(session)
  if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
    throw new Error("You do not have permission to view this task")
  }

  // Build a userId→name map from employees so the drawer can show commenter names
  const employees = await prisma.employee.findMany({
    select: { userId: true, name: true },
    where: { userId: { not: null } },
  })
  const userNameMap: Record<string, string> = {}
  for (const emp of employees) {
    if (emp.userId) userNameMap[emp.userId] = emp.name
  }

  return { task, user: session.user, userNameMap }
}

export async function addComment(
  taskId: string,
  content: string
): Promise<TaskActionState> {
  try {
    const session = await requireAuth()

    const trimmed = content?.trim()
    if (!trimmed) {
      return { fieldErrors: { content: ["Comment cannot be empty"] } }
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      return { error: "Task not found" }
    }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only comment on tasks assigned to you" }
    }

    await prisma.taskComment.create({
      data: {
        taskId,
        userId: session.user.id,
        content: trimmed,
      },
    })

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${taskId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to add comment. Please try again." }
  }
}

export async function deleteComment(commentId: string): Promise<TaskActionState> {
  try {
    const session = await requireAuth()

    const comment = await prisma.taskComment.findFirst({
      where: { id: commentId, ...taskFirmFilter(session) },
    })

    if (!comment) {
      return { error: "Comment not found" }
    }

    // Users can delete their own comments, PARTNER and MANAGER can delete any
    if (session.user.role === "EMPLOYEE" && comment.userId !== session.user.id) {
      return { error: "You can only delete your own comments" }
    }

    await prisma.taskComment.delete({
      where: { id: commentId },
    })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to delete comment. Please try again." }
  }
}

export async function addAttachment(
  taskId: string,
  fileName: string,
  fileUrl: string,
  fileSize?: number,
  fileType?: string
): Promise<TaskActionState> {
  try {
    const session = await requireAuth()

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      return { error: "Task not found" }
    }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only add attachments to tasks assigned to you" }
    }

    await prisma.taskAttachment.create({
      data: {
        taskId,
        fileName,
        fileUrl,
        fileSize,
        fileType,
        uploadedBy: session.user.id,
      },
    })

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${taskId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to add attachment. Please try again." }
  }
}

export async function deleteAttachment(attachmentId: string): Promise<TaskActionState> {
  try {
    const session = await requireAuth()

    const attachment = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId, ...taskFirmFilter(session) },
    })

    if (!attachment) {
      return { error: "Attachment not found" }
    }

    // Users can delete their own attachments, PARTNER and MANAGER can delete any
    if (session.user.role === "EMPLOYEE" && attachment.uploadedBy !== session.user.id) {
      return { error: "You can only delete your own attachments" }
    }

    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: toUserError(error) }
    }
    return { error: "Failed to delete attachment. Please try again." }
  }
}

/**
 * Name who reviews this task.
 *
 * `reviewerEmployeeId` and the TaskReviewer relation have existed since the
 * Task model was written and nothing in the codebase ever wrote them. Sign-off
 * was "any Manager or Partner who is not the assignee", and every UNDER_REVIEW
 * notification went to all of them at once — which in a firm of any size means
 * each one assumes somebody else has it.
 *
 * Naming a reviewer makes the queue somebody's. It does not narrow who *can*
 * sign off: any Manager or Partner still may, because a named reviewer going on
 * leave must not stall a statutory filing.
 */
export async function setTaskReviewer(
  taskId: string,
  reviewerEmployeeId: string | null
): Promise<TaskActionState> {
  try {
    const session = await requirePartnerOrManager()

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, assignedEmployeeId: true },
    })
    if (!task) return { error: "Task not found" }

    if (reviewerEmployeeId) {
      const reviewer = await prisma.employee.findUnique({
        where: { id: reviewerEmployeeId },
        select: { id: true, isActive: true, userId: true, user: { select: { role: true } } },
      })
      if (!reviewer) return { error: "That reviewer no longer exists." }
      if (!reviewer.isActive) {
        return { error: "That team member is disabled and cannot review work." }
      }
      // The reviewer gate exists to stop people signing off their own work, so
      // naming the preparer as their own reviewer would defeat it at the point
      // of setting it rather than at the point of filing.
      if (reviewerEmployeeId === task.assignedEmployeeId) {
        return { error: "Somebody cannot review their own work — pick a different reviewer." }
      }
      if (reviewer.user?.role === "EMPLOYEE") {
        return { error: "Only a Manager or Partner can sign work off." }
      }
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { reviewerEmployeeId },
    })

    revalidatePath("/work-tracker")
    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export type ReviewQueueItem = {
  id: string
  title: string
  clientName: string
  assigneeName: string | null
  dueDate: string | null
  /** True when this is queued to somebody else and shown as unclaimed. */
  unassignedReview: boolean
}

/**
 * What is waiting for me to sign off.
 *
 * There was no such list. Work submitted for review notified every Manager and
 * Partner and then existed only as a status buried in the task board, so the
 * common failure was not rejection — it was nobody picking it up.
 *
 * Reviews named to somebody who is on leave surface here for everybody, rather
 * than sitting in a queue nobody is reading: approvals stalling because the
 * reviewer is away is the reason a named reviewer could have made things worse.
 */
export async function getMyReviewQueue(): Promise<ReviewQueueItem[]> {
  const session = await requireAuth()
  if (session.user.role === "EMPLOYEE" || session.user.role === "CLIENT") return []

  const me = await getExecutiveEmployeeId(session)

  const tasks = await prisma.task.findMany({
    where: { status: "UNDER_REVIEW" },
    include: {
      client: { select: { name: true } },
      assignedEmployee: { select: { name: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "asc" }],
    take: 100,
  })
  if (tasks.length === 0) return []

  // Reviewers who are away today — their queue is everybody's until they are
  // back, which is what stops leave from stalling a filing.
  const now = new Date()
  const awayReviewers = await prisma.employeeLeave.findMany({
    where: {
      status: { in: ["REQUESTED", "APPROVED"] },
      startDate: { lte: now },
      endDate: { gte: now },
    },
    select: { employeeId: true },
  })
  const away = new Set(awayReviewers.map((l) => l.employeeId))

  return tasks
    .filter((t) => {
      // Mine by name; or unclaimed; or named to somebody who is away.
      if (!t.reviewerEmployeeId) return true
      if (t.reviewerEmployeeId === me) return true
      return away.has(t.reviewerEmployeeId)
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      clientName: t.client.name,
      assigneeName: t.assignedEmployee?.name ?? null,
      dueDate: t.dueDate?.toISOString() ?? null,
      unassignedReview: !t.reviewerEmployeeId || t.reviewerEmployeeId !== me,
    }))
}

/**
 * Is this a sensible person to give this work to?
 *
 * Called from the assignment dialog as the assignee and due date are picked, so
 * the answer arrives while the choice is still open rather than as a surprise
 * on a workload report later. Warns; only a disabled account blocks.
 */
export async function checkTaskAssignment(input: {
  employeeId: string
  dueDate?: string | null
  taskId?: string
}): Promise<{ concerns: AssignmentConcern[] }> {
  await requirePartnerOrManager()
  if (!input.employeeId) return { concerns: [] }

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, name: true, isActive: true },
  })
  if (!employee) return { concerns: [] }

  const due = input.dueDate ? new Date(input.dueDate) : null
  const validDue = due && !Number.isNaN(due.getTime()) ? due : null

  // The window a manager is actually deciding about: now until the due date,
  // or the next fortnight when there is no date yet.
  const now = new Date()
  const windowEnd = validDue ?? new Date(now.getTime() + 14 * 86_400_000)

  const [leaveAtDue, leaveInWindow, load, task] = await Promise.all([
    validDue
      ? prisma.employeeLeave.findFirst({
          where: {
            employeeId: employee.id,
            status: { in: ["REQUESTED", "APPROVED"] },
            startDate: { lte: validDue },
            endDate: { gte: validDue },
          },
          select: { startDate: true, endDate: true },
        })
      : Promise.resolve(null),
    prisma.employeeLeave.findMany({
      where: {
        employeeId: employee.id,
        status: { in: ["REQUESTED", "APPROVED"] },
        startDate: { lte: windowEnd },
        endDate: { gte: now },
      },
      select: { startDate: true, endDate: true },
    }),
    prisma.task.count({
      where: {
        assignedEmployeeId: employee.id,
        status: { not: "FILED_DONE" },
        // Exclude the task being edited so re-saving does not count it twice.
        ...(input.taskId ? { id: { not: input.taskId } } : {}),
      },
    }),
    input.taskId
      ? prisma.task.findUnique({
          where: { id: input.taskId },
          select: { reviewerEmployeeId: true },
        })
      : Promise.resolve(null),
  ])

  const { workingDaysAvailable } = await import("@/lib/workforce/capacity")
  const workingDays = workingDaysAvailable(now, windowEnd, leaveInWindow)

  const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })

  return {
    concerns: checkAssignment({
      assigneeName: employee.name,
      isActive: employee.isActive,
      onLeaveAtDueDate: Boolean(leaveAtDue),
      leaveLabel: leaveAtDue ? `from ${fmt(leaveAtDue.startDate)} to ${fmt(leaveAtDue.endDate)}` : null,
      currentLoad: load,
      workingDays,
      isOwnReviewer: task?.reviewerEmployeeId === employee.id,
    }),
  }
}

/**
 * Assign many tasks at once.
 *
 * The monthly ritual is fifty GST filings going to the same handful of people,
 * and it was fifty dialogs. Bulk *re*assignment already existed for handing
 * over a leaver's book; this is the same operation for work nobody has yet.
 *
 * Blocking concerns are checked once for the assignee rather than per task —
 * a disabled account is disabled for all fifty.
 */
export async function bulkAssignTasks(input: {
  taskIds: string[]
  employeeId: string
}): Promise<{ success?: boolean; assigned?: number; error?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to assign tasks." }
  }

  if (input.taskIds.length === 0) return { error: "Nothing selected." }
  if (input.taskIds.length > 200) return { error: "Assign up to 200 tasks at a time." }

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, name: true, isActive: true, userId: true },
  })
  if (!employee) return { error: "That team member no longer exists." }
  if (!employee.isActive) {
    return { error: `${employee.name}'s account is disabled — they cannot open these tasks.` }
  }

  const result = await prisma.task.updateMany({
    where: { id: { in: input.taskIds }, status: { not: "FILED_DONE" } },
    data: {
      assignedEmployeeId: employee.id,
      // Same as a single assignment: the work is offered, not imposed.
      acceptanceStatus: "PENDING",
      acceptedAt: null,
      declinedAt: null,
      declinedReason: null,
      declinedReasonCode: null,
      declinedByEmployeeId: null,
    },
  })

  // One notification for the batch. Fifty separate ones would be noise, and
  // noise is what makes people stop reading the bell.
  if (employee.userId && result.count > 0) {
    await notifyUser(employee.userId, {
      title: `${result.count} task${result.count === 1 ? "" : "s"} assigned to you`,
      message: `${session.user.name} assigned you ${result.count} task${
        result.count === 1 ? "" : "s"
      }. Accept or decline them from your work tracker.`,
      type: "TASK_ASSIGNED",
    })
  }

  revalidatePath("/work-tracker")
  return { success: true, assigned: result.count }
}
