"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  requireAuth,
  requirePartnerOrManager,
} from "@/lib/auth/guards"
import {
  createClientWithOnboarding,
  getClientDetail,
  listClients,
  listEmployees,
  updateClient as updateClientRecord,
} from "@/lib/clients/queries"
import {
  createClientSchema,
  updateClientSchema,
} from "@/lib/validations/client"
import { logClientActivity } from "@/lib/activity/logger"
import { toUserError } from "@/lib/forms/errors"

export type ClientActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function getClientsData() {
  const session = await requireAuth()
  const [clients, employees] = await Promise.all([
    listClients({
      role: session.user.role,
      userId: session.user.id,
    }),
    listEmployees(),
  ])
  return { clients, employees, user: session.user }
}

export async function createClient(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  try {
    const session = await requirePartnerOrManager()

    const servicesRaw = formData.get("services")
    let services: unknown[] = []
    if (typeof servicesRaw === "string" && servicesRaw) {
      try {
        services = JSON.parse(servicesRaw)
      } catch {
        return { error: "Invalid services data" }
      }
    }

    const collectedRaw = formData.get("collectedDocuments")
    let collectedDocuments: unknown[] = []
    if (typeof collectedRaw === "string" && collectedRaw) {
      try {
        collectedDocuments = JSON.parse(collectedRaw)
      } catch {
        collectedDocuments = []
      }
    }

    const raw = {
      name: formData.get("name"),
      companyName: formData.get("companyName") || undefined,
      clientType: formData.get("clientType") || undefined,
      clientTypeCustom: formData.get("clientTypeCustom") || undefined,
      isIncorporated: formData.get("isIncorporated") ?? "true",
      gstin: formData.get("gstin") || undefined,
      pan: formData.get("pan") || undefined,
      email: formData.get("email") || undefined,
      phone: formData.get("phone") || undefined,
      whatsapp: formData.get("whatsapp") || undefined,
      address: formData.get("address") || undefined,
      notes: formData.get("notes") || undefined,
      priority: formData.get("priority") || "MEDIUM",
      assignedEmployeeId: formData.get("assignedEmployeeId") || undefined,
      reminderDaysBefore: formData.get("reminderDaysBefore") || 7,
      notificationPreferences: formData.getAll("notificationPreferences"),
      services,
      collectedDocuments,
    }

    const parsed = createClientSchema.safeParse(raw)

    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    const client = await createClientWithOnboarding(parsed.data)
    
    // Log activity
    await logClientActivity(
      client.id,
      "CREATED",
      `Client "${client.name}" was created`,
      session.user.id,
      session.user.name,
      { services: parsed.data.services }
    )

    // Workforce tracking
    try {
      const { trackEmployeeActivity, getEmployeeByUserId } = await import("@/lib/workforce/tracker")
      const employee = await getEmployeeByUserId(session.user.id)
      if (employee) {
        await trackEmployeeActivity({
          employeeId: employee.id,
          userId: session.user.id,
          activityType: "CLIENT_CREATED",
          description: `Created client "${client.name}"`,
          entityType: "CLIENT",
          entityId: client.id,
          entityName: client.name,
        })
      }
    } catch (logErr) { console.error("activity log failed:", logErr) }

    // Auto-generate compliance events for all assigned services
    const { generateComplianceEventsForClient } = await import("@/app/actions/compliance")
    const serviceTypes = parsed.data.services.map((s) => s.serviceType)
    await generateComplianceEventsForClient(client.id, serviceTypes)
    
    revalidatePath("/clients")

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    // LOW-05: map internal errors to safe messages
    return { error: toUserError(error) }
  }
}

export async function updateClient(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  try {
    const session = await requirePartnerOrManager()

    const id = formData.get("id")
    if (typeof id !== "string" || !id) {
      return { error: "Missing client id" }
    }

    // Services are optional — only parsed/synced when the form sends them.
    const servicesRaw = formData.get("services")
    let services: unknown[] | undefined = undefined
    if (typeof servicesRaw === "string" && servicesRaw) {
      try {
        const parsedServices = JSON.parse(servicesRaw)
        if (Array.isArray(parsedServices)) services = parsedServices
      } catch {
        return { error: "Invalid services data" }
      }
    }

    const parsed = updateClientSchema.safeParse({
      name: formData.get("name"),
      companyName: formData.get("companyName") || undefined,
      clientType: formData.get("clientType") || undefined,
      clientTypeCustom: formData.get("clientTypeCustom") || undefined,
      isIncorporated: formData.get("isIncorporated") ?? "true",
      gstin: formData.get("gstin") || undefined,
      pan: formData.get("pan") || undefined,
      email: formData.get("email") || undefined,
      phone: formData.get("phone") || undefined,
      whatsapp: formData.get("whatsapp") || undefined,
      address: formData.get("address") || undefined,
      notes: formData.get("notes") || undefined,
      status: formData.get("status"),
      priority: formData.get("priority") || "MEDIUM",
      assignedEmployeeId: formData.get("assignedEmployeeId") || undefined,
      ...(services !== undefined ? { services } : {}),
    })

    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    await updateClientRecord(id, parsed.data)

    // Newly-added services should start being tracked. Generation is dedup-safe
    // (canonical titles), so existing events are never duplicated.
    if (parsed.data.services && parsed.data.services.length > 0) {
      try {
        const { generateComplianceEventsForClient } = await import("@/app/actions/compliance")
        await generateComplianceEventsForClient(
          id,
          parsed.data.services.map((s) => s.serviceType)
        )
      } catch (genErr) {
        console.error("compliance generation on client update failed:", genErr)
      }
    }
    
    // Log activity
    await logClientActivity(
      id,
      "UPDATED",
      `Client "${parsed.data.name}" was updated`,
      session.user.id,
      session.user.name,
      parsed.data
    )

    // Workforce tracking
    try {
      const { trackEmployeeActivity, getEmployeeByUserId } = await import("@/lib/workforce/tracker")
      const employee = await getEmployeeByUserId(session.user.id)
      if (employee) {
        await trackEmployeeActivity({
          employeeId: employee.id,
          userId: session.user.id,
          activityType: "CLIENT_UPDATED",
          description: `Updated client "${parsed.data.name}"`,
          entityType: "CLIENT",
          entityId: id,
          entityName: parsed.data.name,
        })
      }
    } catch (logErr) { console.error("activity log failed:", logErr) }

    revalidatePath("/clients")
    revalidatePath(`/clients/${id}`)

    return { success: true }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { fieldErrors: error.flatten().fieldErrors }
    }
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to edit clients." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to update client. Please try again." }
  }
}

export async function getClientProfile(id: string) {
  const session = await requireAuth()
  const client = await getClientDetail(id, {
    role: session.user.role,
    userId: session.user.id,
  })

  return { client, user: session.user }
}

export async function deleteClient(clientId: string): Promise<ClientActionState> {
  try {
    const session = await requirePartnerOrManager()

    const { prisma } = await import("@/lib/prisma")
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) return { error: "Client not found." }

    // Soft delete → recycle bin. Restore/purge live in app/actions/trash.ts.
    await prisma.client.update({
      where: { id: clientId },
      data: { deletedAt: new Date() },
    })

    // Partners hear when a Manager bins a client (restorable, but reportable).
    if (session.user.role === "MANAGER") {
      const { notifyRoles } = await import("@/lib/notifications/notify")
      await notifyRoles(
        ["PARTNER"],
        {
          title: `Client moved to recycle bin: ${client.name}`,
          message: `${session.user.name} deleted client "${client.name}" (${client.clientCode}). It can be restored from the Recycle Bin.`,
          type: "WARNING",
          entityType: "CLIENT",
          entityId: clientId,
        },
        { excludeUserId: session.user.id }
      )
    }

    await logClientActivity(
      clientId,
      "DELETED",
      `Client "${client.name}" was moved to the recycle bin`,
      session.user.id,
      session.user.name
    )

    revalidatePath("/clients")
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to delete clients." }
      }
      return { error: toUserError(error) }
    }
    return { error: "Failed to delete client. Please try again." }
  }
}
