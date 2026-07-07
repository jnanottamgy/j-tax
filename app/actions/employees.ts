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
      isActive: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const employees = rows.map(({ user, ...rest }) => ({
    ...rest,
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

    if (assignedClients > 0) {
      return {
        error: `Cannot delete — ${assignedClients} client(s) are assigned to this employee. Reassign them first.`,
      }
    }
    if (openTasks > 0) {
      return {
        error: `Cannot delete — ${openTasks} open task(s) are assigned to this employee. Complete or reassign them first.`,
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

    // Partners hear when a Manager locks a team member out.
    if (session.user.role === "MANAGER") {
      const { notifyRoles } = await import("@/lib/notifications/notify")
      await notifyRoles(
        ["PARTNER"],
        {
          title: `Team member disabled: ${existing.name}`,
          message: `${session.user.name} disabled ${existing.name} (${existing.email}) and locked their login.`,
          type: "WARNING",
          entityType: "USER",
          entityId: existing.userId ?? existing.id,
        },
        { excludeUserId: session.user.id }
      )
    }

    revalidatePath("/employees")
    return { success: true }
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
