"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import type { FormActionState } from "@/lib/forms/types"
import { parseEmployeeFormData } from "@/lib/validations/employee"

import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"

export async function getEmployeesData() {
  // C-01 fix: use real session instead of hardcoded mock user
  const session = await requirePartnerOrManager()

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return { employees, user: session.user }
}

export async function createEmployee(
  prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  // C-02 fix: enforce PARTNER/MANAGER auth on all mutations
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to create employees." }
  }

  const validation = parseEmployeeFormData(formData)
  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors }
  }

  const data = validation.data

  try {
    const existingEmployee = await prisma.employee.findUnique({
      where: { email: data.email },
    })

    if (existingEmployee) {
      return { error: "An employee with this email already exists." }
    }

    const linkedUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    })

    await prisma.employee.create({
      data: {
        name: data.name,
        email: data.email,
        department: data.department?.trim() ? data.department : null,
        isActive: data.isActive,
        userId: linkedUser?.id ?? null,
      },
    })

    revalidatePath("/employees")
    return { success: true }
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
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to update employees." }
  }

  const validation = parseEmployeeFormData(formData)
  if (!validation.success) {
    return { fieldErrors: validation.error.flatten().fieldErrors }
  }

  const data = validation.data

  try {
    const existing = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!existing) {
      return { error: "Employee not found." }
    }

    const emailTaken = await prisma.employee.findFirst({
      where: { email: data.email, NOT: { id: employeeId } },
    })
    if (emailTaken) {
      return { fieldErrors: { email: ["An employee with this email already exists."] } }
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

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Failed to update employee:", error)
    return { error: "Failed to update employee. Please try again." }
  }
}

export async function deleteEmployee(employeeId: string) {
  // C-02 fix: enforce PARTNER/MANAGER auth on all mutations
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to delete employees." }
  }

  try {
    const existing = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!existing) {
      return { error: "Employee not found." }
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    })

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete employee:", error)
    return { error: "Failed to delete employee. Please try again." }
  }
}

export async function disableEmployee(employeeId: string) {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to disable employees." }
  }

  try {
    const existing = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!existing) return { error: "Employee not found." }
    if (!existing.isActive) return { success: true }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false },
    })

    revalidatePath("/employees")
    return { success: true }
  } catch (error) {
    console.error("Failed to disable employee:", error)
    return { error: "Failed to disable employee. Please try again." }
  }
}

export async function enableEmployee(employeeId: string) {
  try {
    await requirePartnerOrManager()
  } catch {
    return { error: "You do not have permission to enable employees." }
  }

  try {
    const existing = await prisma.employee.findUnique({ where: { id: employeeId } })
    if (!existing) return { error: "Employee not found." }
    if (existing.isActive) return { success: true }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: true },
    })

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

  const [total, employees] = await Promise.all([
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
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return {
    employees,
    total,
    page,
    pageSize,
    user: session.user,
  }
}
