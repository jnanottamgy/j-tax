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
} from "@/lib/auth/scope"
import type { FormActionState } from "@/lib/forms/types"
import { prisma } from "@/lib/prisma"
import { notifyRoles, notifyUser } from "@/lib/notifications/notify"
import { parseCreateTaskFormData, taskBaseSchema } from "@/lib/validations/task"
import { recordTimelineEvent } from "@/lib/timeline/events"

export type TaskActionState = FormActionState

const taskSchema = taskBaseSchema

export async function getTasksData(filters?: {
  status?: string
  priority?: string
  assignedEmployeeId?: string
  search?: string
  serviceType?: string
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

    const willAssign = Boolean(assignedEmployeeId?.trim())
    const newTask = await prisma.task.create({
      data: {
        ...taskFields,
        clientId,
        description: description?.trim() ? description : null,
        assignedEmployeeId: willAssign ? assignedEmployeeId : null,
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

    await prisma.task.update({
      where: { id },
      data: {
        ...parsed.data,
        ...acceptanceReset,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        completionDate: parsed.data.completionDate ? new Date(parsed.data.completionDate) : null,
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
export async function declineTask(taskId: string, reason: string): Promise<TaskActionState> {
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

    await prisma.task.update({
      where: { id: taskId },
      data: {
        acceptanceStatus: "DECLINED",
        declinedAt: new Date(),
        declinedReason: reason.trim(),
        acceptedAt: null,
      },
    })

    await notifyRoles(
      ["PARTNER", "MANAGER"],
      {
        title: "Task declined",
        message: `${session.user.name} declined "${task.title}" (${task.client.name}): ${reason.trim()}`,
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
  status: string
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

    // Review gate — an employee cannot sign off their own filing. They submit
    // work as UNDER_REVIEW; a Manager/Partner moves it to FILED_DONE.
    if (status === "FILED_DONE" && session.user.role === "EMPLOYEE") {
      return {
        error:
          'Submit it as "Under Review" instead — a Manager or Partner signs off Filed/Done.',
      }
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

    const updateData: any = { status }

    // Auto-set completion date when marked as FILED_DONE
    if (status === "FILED_DONE" && !task.completionDate) {
      updateData.completionDate = new Date()
    }

    await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    })

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
      await notifyRoles(["PARTNER", "MANAGER"], {
        title: `Ready for review: ${task.title}`,
        message: `${session.user.name} submitted "${task.title}"${client ? ` (${client.name})` : ""} for sign-off.`,
        type: "INFO",
        entityType: "TASK",
        entityId: taskId,
      })
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

    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
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

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
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
