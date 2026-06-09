"use server"

import { revalidatePath } from "next/cache"
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
import { parseCreateTaskFormData, taskBaseSchema } from "@/lib/validations/task"

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
  } else if (session.user.role === "EXECUTIVE") {
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
    await requirePartnerOrManager()

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

    await prisma.task.create({
      data: {
        ...taskFields,
        clientId,
        description: description?.trim() ? description : null,
        assignedEmployeeId: assignedEmployeeId?.trim() ? assignedEmployeeId : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        completionDate: completionDate ? new Date(completionDate) : null,
      },
    })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to create tasks." }
      }
      return { error: error.message }
    }
    return { error: "Failed to create task. Please try again." }
  }
}

export async function updateTask(
  _prevState: TaskActionState,
  formData: FormData
): Promise<TaskActionState> {
  try {
    const session = await requireAuth()

    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return { error: "Missing task id" }
    }

    // Check permissions
    const task = await prisma.task.findUnique({
      where: { id },
    })

    if (!task) {
      return { error: "Task not found" }
    }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only update tasks assigned to you" }
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

    // Only PARTNER and MANAGER can reassign tasks
    if (parsed.data.assignedEmployeeId && parsed.data.assignedEmployeeId !== task.assignedEmployeeId) {
      if (session.user.role === "EXECUTIVE") {
        return { error: "You do not have permission to reassign tasks" }
      }
    }

    await prisma.task.update({
      where: { id },
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        completionDate: parsed.data.completionDate ? new Date(parsed.data.completionDate) : null,
      },
    })

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${id}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to edit this task." }
      }
      return { error: error.message }
    }
    return { error: "Failed to update task. Please try again." }
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

    const updateData: any = { status }
    
    // Auto-set completion date when marked as FILED_DONE
    if (status === "FILED_DONE" && !task.completionDate) {
      updateData.completionDate = new Date()
    }

    await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    })

    revalidatePath("/work-tracker")
    revalidatePath(`/work-tracker/${taskId}`)

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Failed to update task status. Please try again." }
  }
}

export async function deleteTask(taskId: string): Promise<TaskActionState> {
  try {
    await requirePartnerOrManager()

    await prisma.task.delete({
      where: { id: taskId },
    })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to delete tasks." }
      }
      return { error: error.message }
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
      return { error: error.message }
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
    if (session.user.role === "EXECUTIVE" && comment.userId !== session.user.id) {
      return { error: "You can only delete your own comments" }
    }

    await prisma.taskComment.delete({
      where: { id: commentId },
    })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
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
      return { error: error.message }
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
    if (session.user.role === "EXECUTIVE" && attachment.uploadedBy !== session.user.id) {
      return { error: "You can only delete your own attachments" }
    }

    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Failed to delete attachment. Please try again." }
  }
}
