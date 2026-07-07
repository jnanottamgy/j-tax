"use server"

/**
 * Task dependencies — "blocked by" sequencing between tasks.
 *
 * A task with open blockers cannot move to IN_PROGRESS / UNDER_REVIEW /
 * FILED_DONE (guard lives in updateTaskStatus). Dependencies are
 * cycle-checked here at write time so the graph always stays a DAG.
 */

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth/guards"
import { canAccessAssignedTask, getExecutiveEmployeeId } from "@/lib/auth/scope"
import { toUserError } from "@/lib/forms/errors"
import { prisma } from "@/lib/prisma"

export type DependencyActionState = { success?: boolean; error?: string }

/**
 * Would adding taskId→blockerId create a cycle?
 * Walk upward from the blocker through ITS blockers; if we ever reach the
 * dependent task, the new edge closes a loop.
 */
async function wouldCreateCycle(taskId: string, blockerId: string): Promise<boolean> {
  const visited = new Set<string>([blockerId])
  let frontier = [blockerId]
  // Bounded walk — dependency graphs are tiny; 25 hops is beyond any real chain
  for (let depth = 0; depth < 25 && frontier.length > 0; depth++) {
    const edges = await prisma.taskDependency.findMany({
      where: { taskId: { in: frontier } },
      select: { blockerId: true },
    })
    frontier = []
    for (const e of edges) {
      if (e.blockerId === taskId) return true
      if (!visited.has(e.blockerId)) {
        visited.add(e.blockerId)
        frontier.push(e.blockerId)
      }
    }
  }
  return false
}

export async function addTaskDependency(
  taskId: string,
  blockerId: string
): Promise<DependencyActionState> {
  try {
    const session = await requireAuth()

    if (taskId === blockerId) {
      return { error: "A task cannot block itself." }
    }

    const [task, blocker] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId }, select: { id: true, assignedEmployeeId: true, clientId: true } }),
      prisma.task.findUnique({ where: { id: blockerId }, select: { id: true, title: true, status: true } }),
    ])
    if (!task || !blocker) return { error: "Task not found." }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only manage dependencies on tasks assigned to you." }
    }

    if (blocker.status === "FILED_DONE") {
      return { error: `"${blocker.title}" is already completed — no need to wait on it.` }
    }

    if (await wouldCreateCycle(taskId, blockerId)) {
      return { error: "That would create a circular dependency (the blocker already waits on this task)." }
    }

    await prisma.taskDependency.upsert({
      where: { taskId_blockerId: { taskId, blockerId } },
      update: {},
      create: { taskId, blockerId },
    })

    revalidatePath("/work-tracker")
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? toUserError(error) : "Failed to add dependency." }
  }
}

export async function removeTaskDependency(
  taskId: string,
  blockerId: string
): Promise<DependencyActionState> {
  try {
    const session = await requireAuth()

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assignedEmployeeId: true },
    })
    if (!task) return { error: "Task not found." }

    const executiveEmployeeId = await getExecutiveEmployeeId(session)
    if (!canAccessAssignedTask(session, executiveEmployeeId, task.assignedEmployeeId)) {
      return { error: "You can only manage dependencies on tasks assigned to you." }
    }

    await prisma.taskDependency.deleteMany({ where: { taskId, blockerId } })

    revalidatePath("/work-tracker")
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? toUserError(error) : "Failed to remove dependency." }
  }
}

/**
 * Candidate blockers for the picker: open tasks of the same client,
 * excluding the task itself and already-linked blockers.
 */
export async function getDependencyOptions(taskId: string): Promise<
  Array<{ id: string; title: string; status: string }>
> {
  const session = await requireAuth()

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { clientId: true, assignedEmployeeId: true },
  })
  if (!task) return []

  // Employees may only browse blockers for their own tasks.
  const employeeScopeId = await getExecutiveEmployeeId(session)
  if (!canAccessAssignedTask(session, employeeScopeId, task.assignedEmployeeId)) {
    return []
  }

  const existing = await prisma.taskDependency.findMany({
    where: { taskId },
    select: { blockerId: true },
  })
  const exclude = new Set([taskId, ...existing.map((e) => e.blockerId)])

  const candidates = await prisma.task.findMany({
    where: {
      clientId: task.clientId,
      status: { not: "FILED_DONE" },
    },
    select: { id: true, title: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return candidates.filter((c) => !exclude.has(c.id))
}
