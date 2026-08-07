"use server"

import { revalidatePath } from "next/cache"

import { requireAuth } from "@/lib/auth/guards"
import {
  canAccessAssignedTask,
  getEmployeeScopeId,
  taskFirmFilter,
} from "@/lib/auth/scope"
import { toUserError } from "@/lib/forms/errors"
import { prisma } from "@/lib/prisma"

/**
 * Task checklist actions.
 *
 * Scoping mirrors app/actions/tasks.ts: PARTNER/MANAGER touch any checklist,
 * EMPLOYEE only checklists of tasks assigned to them (Employee.userId ↔
 * session user id via getEmployeeScopeId + canAccessAssignedTask).
 */

export type ChecklistItemRow = {
  id: string
  title: string
  done: boolean
  sortOrder: number
}

export type ChecklistActionState = {
  success?: boolean
  error?: string
  item?: ChecklistItemRow
}

export async function getChecklist(taskId: string): Promise<ChecklistItemRow[]> {
  const session = await requireAuth()

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      assignedEmployeeId: true,
      checklistItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, done: true, sortOrder: true },
      },
    },
  })

  if (!task) {
    throw new Error("Task not found")
  }

  const employeeScopeId = await getEmployeeScopeId(session)
  if (!canAccessAssignedTask(session, employeeScopeId, task.assignedEmployeeId)) {
    throw new Error("You do not have permission to view this checklist")
  }

  return task.checklistItems
}

export async function addChecklistItem(
  taskId: string,
  title: string
): Promise<ChecklistActionState> {
  try {
    const session = await requireAuth()

    const trimmed = title?.trim()
    if (!trimmed) {
      return { error: "Step title cannot be empty" }
    }
    if (trimmed.length > 200) {
      return { error: "Step title is too long (max 200 characters)" }
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, assignedEmployeeId: true },
    })

    if (!task) {
      return { error: "Task not found" }
    }

    const employeeScopeId = await getEmployeeScopeId(session)
    if (!canAccessAssignedTask(session, employeeScopeId, task.assignedEmployeeId)) {
      return { error: "You can only edit checklists of tasks assigned to you" }
    }

    const maxSort = await prisma.taskChecklistItem.aggregate({
      where: { taskId },
      _max: { sortOrder: true },
    })

    const item = await prisma.taskChecklistItem.create({
      data: {
        taskId,
        title: trimmed,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      select: { id: true, title: true, done: true, sortOrder: true },
    })

    revalidatePath("/work-tracker")

    return { success: true, item }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function toggleChecklistItem(
  itemId: string,
  done: boolean
): Promise<ChecklistActionState> {
  try {
    const session = await requireAuth()

    const item = await prisma.taskChecklistItem.findFirst({
      where: { id: itemId, ...taskFirmFilter(session) },
      select: {
        id: true,
        task: { select: { assignedEmployeeId: true } },
      },
    })

    if (!item) {
      return { error: "Checklist item not found" }
    }

    const employeeScopeId = await getEmployeeScopeId(session)
    if (!canAccessAssignedTask(session, employeeScopeId, item.task.assignedEmployeeId)) {
      return { error: "You can only update checklists of tasks assigned to you" }
    }

    await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: { done },
    })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}

export async function deleteChecklistItem(
  itemId: string
): Promise<ChecklistActionState> {
  try {
    const session = await requireAuth()

    const item = await prisma.taskChecklistItem.findFirst({
      where: { id: itemId, ...taskFirmFilter(session) },
      select: {
        id: true,
        task: { select: { assignedEmployeeId: true } },
      },
    })

    if (!item) {
      return { error: "Checklist item not found" }
    }

    const employeeScopeId = await getEmployeeScopeId(session)
    if (!canAccessAssignedTask(session, employeeScopeId, item.task.assignedEmployeeId)) {
      return { error: "You can only edit checklists of tasks assigned to you" }
    }

    await prisma.taskChecklistItem.delete({ where: { id: itemId } })

    revalidatePath("/work-tracker")

    return { success: true }
  } catch (error) {
    return { error: toUserError(error) }
  }
}
