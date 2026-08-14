"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { FormActionState } from "@/lib/forms/types"
import { parseEmployeeFormData } from "@/lib/validations/employee"

import { requirePartnerOrManager } from "@/lib/auth/guards"
import {
  provisionStaffAccount,
  resetStaffPassword,
  setStaffLoginBanned,
  updateStaffRole,
} from "@/lib/auth/provisioning"

/**
 * A MANAGER may only manage EMPLOYEE-role team members. Only a PARTNER can
 * disable/delete/manage another MANAGER. Targets with no linked login (role
 * unknown) are treated as manageable by either. Returns an error string if
 * the actor is not allowed to act on the target, else null.
 */
function targetRoleGuard(
  actorRole: string,
  targetRole: string | null | undefined
): string | null {
  if (targetRole === "MANAGER" && actorRole !== "PARTNER") {
    return "Only a Partner can manage another Manager."
  }
  return null
}

export async function getEmployeesData() {
  // C-01 fix: use real session instead of hardcoded mock user
  const session = await requirePartnerOrManager()

  const rows = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      billingRatePerHour: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const employees = rows.map(({ user, billingRatePerHour, ...rest }) => ({
    ...rest,
    // Decimal can't cross the server → client boundary.
    billingRatePerHour: billingRatePerHour != null ? Number(billingRatePerHour) : null,
    role:
      user?.role === "MANAGER" || user?.role === "EMPLOYEE" ? user.role : null,
  }))

  return { employees, user: session.user }
}

export async function createEmployee(
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  // C-02 fix: enforce PARTNER/MANAGER auth on all mutations
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to create employees." }
  }

  const validation = parseEmployeeFormData(formData)
  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors }
  }

  const data = validation.data

  // Only a Partner can grant the MANAGER role.
  if (data.role === "MANAGER" && session.user.role !== "PARTNER") {
    return { fieldErrors: { role: ["Only a Partner can add Managers."] } }
  }

  try {
    // Email is unique per firm now — findFirst is tenant-scoped automatically.
    const existingEmployee = await prisma.employee.findFirst({
      where: { email: data.email },
    })

    if (existingEmployee) {
      return { error: "An employee with this email already exists." }
    }

    // Create a real login for the new hire (Supabase auth + Prisma User
    // mirror). Invite email goes out via Resend; the temp password is also
    // returned so the creator can hand it over if email delivery fails.
    const provisioned = await provisionStaffAccount({
      name: data.name,
      email: data.email,
      role: data.role,
    })

    if (!provisioned.ok) {
      return { error: provisioned.error }
    }

    await prisma.employee.create({
      data: {
        name: data.name,
        email: data.email,
        department: data.department?.trim() ? data.department : null,
        billingRatePerHour: data.billingRatePerHour?.trim()
          ? Number(data.billingRatePerHour)
          : null,
        isActive: data.isActive,
        userId: provisioned.userId,
      },
    })

    revalidatePath("/employees")

    if (provisioned.alreadyExisted) {
      return {
        success: true,
        message: "Employee added. A login already existed for this email, so no new credentials were issued.",
      }
    }

    return {
      success: true,
      data: {
        tempPassword: provisioned.tempPassword,
        emailSent: provisioned.emailSent,
        // Surfaced in the dialog so the Partner can act on the real cause
        // (unverified sender domain, missing API key) instead of guessing.
        emailError: provisioned.emailError,
        email: data.email,
      },
    }
  } catch (error) {
    console.error("Failed to create employee:", error)
    return { error: "Failed to create employee. Please try again." }
  }
}

export async function updateEmployee(
  employeeId: string,
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  // C-02 fix: enforce PARTNER/MANAGER auth on all mutations
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to update employees." }
  }

  const validation = parseEmployeeFormData(formData)
  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors }
  }

  const data = validation.data

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { id: true, role: true } } },
    })
    if (!existing) {
      return { error: "Employee not found." }
    }

    const emailTaken = await prisma.employee.findFirst({
      where: { email: data.email, NOT: { id: employeeId } },
    })
    if (emailTaken) {
      return { fieldErrors: { email: ["An employee with this email already exists."] } }
    }

    // Role changes (promote/demote between EMPLOYEE and MANAGER) are Partner-only
    // and are mirrored to the auth account so the change applies at next login.
    if (existing.user && existing.user.role !== data.role) {
      if (session.user.role !== "PARTNER") {
        return { fieldErrors: { role: ["Only a Partner can change a team member's role."] } }
      }
      await updateStaffRole(existing.user.id, data.role)
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        name: data.name,
        email: data.email,
        department: data.department?.trim() ? data.department : null,
        billingRatePerHour: data.billingRatePerHour?.trim()
          ? Number(data.billingRatePerHour)
          : null,
        isActive: data.isActive,
      },
    })

    // Keep the denormalized assignee name on clients in sync so dashboards,
    // tables, and the Client 360 don't show the old name after a rename.
    if (existing.name !== data.name) {
      await prisma.client.updateMany({
        where: { assignedEmployeeId: employeeId },
        data: { assignedEmployeeName: data.name },
      })
      revalidatePath("/clients")
    }

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Failed to update employee:", error)
    return { error: "Failed to update employee. Please try again." }
  }
}

export async function deleteEmployee(employeeId: string) {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to delete employees." }
  }

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { role: true } } },
    })
    if (!existing) return { error: "Employee not found." }

    // A Manager cannot delete another Manager — only a Partner can.
    const roleErr = targetRoleGuard(session.user.role, existing.user?.role)
    if (roleErr) return { error: roleErr }

    // Prevent deletion when the employee still owns clients or open tasks
    const [assignedClients, openTasks] = await Promise.all([
      prisma.client.count({ where: { assignedEmployeeId: employeeId } }),
      prisma.task.count({
        where: { assignedEmployeeId: employeeId, status: { not: "FILED_DONE" } },
      }),
    ])

    // Blocking is right — deleting would orphan live work. But the message
    // used to end at "reassign them first" with no tool anywhere in the product
    // to do it, which left a partner opening 40 records by hand. `needsHandover`
    // tells the UI to open the handover dialog instead of just complaining.
    if (assignedClients > 0 || openTasks > 0) {
      const parts = [
        assignedClients > 0 && `${assignedClients} client${assignedClients === 1 ? "" : "s"}`,
        openTasks > 0 && `${openTasks} open task${openTasks === 1 ? "" : "s"}`,
      ].filter(Boolean)
      return {
        error: `${existing.name} still holds ${parts.join(" and ")}. Hand that over to someone first — deleting now would strand it.`,
        needsHandover: { employeeId, openTasks, clients: assignedClients },
      }
    }

    await prisma.employee.delete({ where: { id: employeeId } })

    // Partners hear when a Manager removes a team member entirely.
    if (session.user.role === "MANAGER") {
      const { notifyRoles } = await import("@/lib/notifications/notify")
      await notifyRoles(
        ["PARTNER"],
        {
          title: `Team member deleted: ${existing.name}`,
          message: `${session.user.name} permanently removed ${existing.name} (${existing.email}) from the team.`,
          type: "WARNING",
        },
        { excludeUserId: session.user.id }
      )
    }

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete employee:", error)
    return { error: "Failed to delete employee. Please try again." }
  }
}

export async function disableEmployee(employeeId: string) {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to disable employees." }
  }

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { role: true } } },
    })
    if (!existing) return { error: "Employee not found." }
    const roleErr = targetRoleGuard(session.user.role, existing.user?.role)
    if (roleErr) return { error: roleErr }
    if (!existing.isActive) return { success: true }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    })

    // Disabled means locked out — block the linked login too (best-effort).
    if (existing.userId) {
      await setStaffLoginBanned(existing.userId, true)
    }

    // What they were still holding when the door shut.
    //
    // Disabling is not blocked the way deleting is — cutting access is often
    // urgent and should never wait on a tidy-up. But it used to end here, and
    // the work stayed assigned to an account that could no longer open it.
    // Because the tasks WERE assigned, the "Nobody assigned" queue never
    // surfaced them either, so they simply went quiet. The counts come back so
    // the caller can offer the handover immediately, and the dashboard now
    // carries an "Owner has been deactivated" queue as the backstop.
    const [openTasks, clients] = await Promise.all([
      prisma.task.count({
        where: { assignedEmployeeId: employeeId, status: { not: "FILED_DONE" } },
      }),
      prisma.client.count({ where: { assignedEmployeeId: employeeId, deletedAt: null } }),
    ])

    // Partners hear when a Manager locks a team member out.
    if (session.user.role === "MANAGER") {
      const { notifyRoles } = await import("@/lib/notifications/notify")
      await notifyRoles(
        ["PARTNER"],
        {
          title: `Team member disabled: ${existing.name}`,
          message:
            `${session.user.name} disabled ${existing.name} (${existing.email}) and locked their login.` +
            (openTasks > 0 || clients > 0
              ? ` ${openTasks} open task${openTasks === 1 ? "" : "s"} and ${clients} client${clients === 1 ? "" : "s"} still sit with them.`
              : ""),
          type: "WARNING",
          entityType: "USER",
          entityId: existing.userId ?? existing.id,
        },
        { excludeUserId: session.user.id }
      )
    }

    revalidatePath("/employees")
    revalidatePath("/")
    return { success: true, stranded: { openTasks, clients } }
  } catch (error) {
    console.error("Failed to disable employee:", error)
    return { error: "Failed to disable employee. Please try again." }
  }
}

export async function resetEmployeePassword(
  employeeId: string
): Promise<{ success?: boolean; error?: string; tempPassword?: string; email?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to reset passwords." }
  }

  const existing = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { select: { id: true, role: true } } },
  })
  if (!existing) return { error: "Employee not found." }

  // A Manager may only reset an Employee's password; Managers are Partner-only.
  const roleErr = targetRoleGuard(session.user.role, existing.user?.role)
  if (roleErr) return { error: roleErr }

  if (!existing.userId) {
    return { error: "This team member has no login account yet — add them with an email to create one." }
  }

  const result = await resetStaffPassword(existing.userId)
  if (!result.ok) return { error: result.error }

  return { success: true, tempPassword: result.tempPassword, email: existing.email }
}

export async function enableEmployee(employeeId: string) {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to enable employees." }
  }

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { role: true } } },
    })
    if (!existing) return { error: "Employee not found." }
    const roleErr = targetRoleGuard(session.user.role, existing.user?.role)
    if (roleErr) return { error: roleErr }
    if (existing.isActive) return { success: true }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: true },
    })

    // Re-enable the linked login (best-effort).
    if (existing.userId) {
      await setStaffLoginBanned(existing.userId, false)
    }

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Failed to enable employee:", error)
    return { error: "Failed to enable employee. Please try again." }
  }
}

export type ListEmployeesParams = {
  query?: string
  department?: string | null
  status?: "active" | "inactive" | "all"
  page?: number
  pageSize?: number
}

export async function listEmployeesData(params: ListEmployeesParams) {
  const session = await requirePartnerOrManager()

  const query = (params.query ?? "").trim()
  const department = (params.department ?? "").trim()
  const status = params.status ?? "all"

  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 50)
  const page = Math.max(params.page ?? 1, 1)

  const orFilters: any[] = query
    ? [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } },
      ]
    : []

  const where: any = {
    ...(orFilters.length ? { OR: orFilters } : {}),
    ...(department ? { department: { equals: department } } : {}),
    ...(status === "active"
      ? { isActive: true }
      : status === "inactive"
        ? { isActive: false }
        : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const employees = rows.map(({ user, ...rest }) => ({
    ...rest,
    role:
      user?.role === "MANAGER" || user?.role === "EMPLOYEE" ? user.role : null,
  }))

  return {
    employees,
    total,
    page,
    pageSize,
    user: session.user,
  }
}

// ─── Handover ────────────────────────────────────────────────────────────────

export type EmployeeWorkload = {
  employeeId: string
  employeeName: string
  isActive: boolean
  openTasks: number
  overdueTasks: number
  clients: number
  /** Open tasks under review that only this person can currently move. */
  underReview: number
}

/**
 * What a team member is still holding.
 *
 * Needed at three moments that were all previously blind: before disabling
 * someone, before deleting them (where the error already says "reassign 40
 * items" without telling you which), and when rebalancing a workload.
 */
export async function getEmployeeWorkload(
  employeeId: string
): Promise<EmployeeWorkload | null> {
  await requirePartnerOrManager()

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, isActive: true },
  })
  if (!employee) return null

  const [openTasks, overdueTasks, underReview, clients] = await Promise.all([
    prisma.task.count({
      where: { assignedEmployeeId: employeeId, status: { not: "FILED_DONE" } },
    }),
    prisma.task.count({
      where: {
        assignedEmployeeId: employeeId,
        status: { not: "FILED_DONE" },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.task.count({
      where: { assignedEmployeeId: employeeId, status: "UNDER_REVIEW" },
    }),
    prisma.client.count({ where: { assignedEmployeeId: employeeId, deletedAt: null } }),
  ])

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    isActive: employee.isActive,
    openTasks,
    overdueTasks,
    underReview,
    clients,
  }
}

/** Active team members another person's work can be handed to. */
export async function getReassignTargets(
  excludeEmployeeId?: string
): Promise<Array<{ id: string; name: string; openTasks: number }>> {
  await requirePartnerOrManager()

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
    },
    select: {
      id: true,
      name: true,
      _count: { select: { tasks: { where: { status: { not: "FILED_DONE" } } } } },
    },
    orderBy: { name: "asc" },
  })

  // Current load rides along so the person doing the handover can see who is
  // already buried before they pick.
  return employees.map((e) => ({ id: e.id, name: e.name, openTasks: e._count.tasks }))
}

/**
 * Move a team member's open work and client ownership to someone else.
 *
 * The product could block a deletion because someone held 40 items and then
 * offer no way to move them — the partner was expected to open 40 records by
 * hand. This is the missing tool, and it is also what makes disabling someone
 * safe: their access is cut immediately, their work is handed over deliberately.
 *
 * Completed tasks stay where they are: they are the record of who did the work.
 */
export async function reassignEmployeeWork(input: {
  fromEmployeeId: string
  toEmployeeId: string
  includeTasks?: boolean
  includeClients?: boolean
}): Promise<{ success: boolean; tasks: number; clients: number; error?: string }> {
  let session
  try {
    session = await requirePartnerOrManager()
  } catch {
    return { success: false, tasks: 0, clients: 0, error: "Permission denied." }
  }

  const { fromEmployeeId, toEmployeeId } = input
  const includeTasks = input.includeTasks ?? true
  const includeClients = input.includeClients ?? true

  if (!fromEmployeeId || !toEmployeeId) {
    return { success: false, tasks: 0, clients: 0, error: "Pick who to hand the work to." }
  }
  if (fromEmployeeId === toEmployeeId) {
    return { success: false, tasks: 0, clients: 0, error: "That's the same person." }
  }

  const [from, to] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: fromEmployeeId },
      include: { user: { select: { role: true } } },
    }),
    prisma.employee.findUnique({ where: { id: toEmployeeId } }),
  ])

  if (!from) return { success: false, tasks: 0, clients: 0, error: "Team member not found." }
  if (!to) return { success: false, tasks: 0, clients: 0, error: "Recipient not found." }
  if (!to.isActive) {
    return {
      success: false,
      tasks: 0,
      clients: 0,
      error: `${to.name} is disabled — pick someone who can actually pick the work up.`,
    }
  }

  // Same authority rule as disable/delete: a Manager cannot redistribute
  // another Manager's book.
  const roleErr = targetRoleGuard(session.user.role, from.user?.role)
  if (roleErr) return { success: false, tasks: 0, clients: 0, error: roleErr }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let tasks = 0
      let clients = 0

      if (includeTasks) {
        // Acceptance resets to PENDING: the new owner has not agreed to this
        // work, and silently inheriting an "accepted" state would skip the
        // handshake the whole assignment flow is built on.
        const moved = await tx.task.updateMany({
          where: { assignedEmployeeId: fromEmployeeId, status: { not: "FILED_DONE" } },
          data: {
            assignedEmployeeId: toEmployeeId,
            acceptanceStatus: "PENDING",
            acceptedAt: null,
            declinedAt: null,
            declinedReason: null,
          },
        })
        tasks = moved.count
      }

      if (includeClients) {
        const moved = await tx.client.updateMany({
          where: { assignedEmployeeId: fromEmployeeId, deletedAt: null },
          data: { assignedEmployeeId: toEmployeeId, assignedEmployeeName: to.name },
        })
        clients = moved.count
      }

      return { tasks, clients }
    })

    if (result.tasks > 0 && to.userId) {
      const { notifyUser } = await import("@/lib/notifications/notify")
      await notifyUser(to.userId, {
        title: `${result.tasks} task${result.tasks === 1 ? "" : "s"} handed to you`,
        message: `${session.user.name} moved ${from.name}'s open work to you. Accept each one to start.`,
        type: "INFO",
        entityType: "USER",
        entityId: to.id,
      }).catch(() => { /* the reassignment itself already succeeded */ })
    }

    revalidatePath("/employees")
    revalidatePath("/work-tracker")
    revalidatePath("/clients")
    revalidatePath("/")

    return { success: true, tasks: result.tasks, clients: result.clients }
  } catch (error) {
    console.error("Failed to reassign employee work:", error)
    return { success: false, tasks: 0, clients: 0, error: "Could not move the work. Please try again." }
  }
}
