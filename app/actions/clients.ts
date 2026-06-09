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
  seedEmployeesIfEmpty,
  updateClient as updateClientRecord,
} from "@/lib/clients/queries"
import {
  createClientSchema,
  updateClientSchema,
} from "@/lib/validations/client"
import { logClientActivity } from "@/lib/activity/logger"

export type ClientActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export async function getClientsData() {
  const session = await requireAuth()
  await seedEmployeesIfEmpty()
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

    const raw = {
      name: formData.get("name"),
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
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return { error: "A client with this GSTIN or code already exists." }
      }
      if (error.message.includes("Forbidden")) {
        return { error: "You do not have permission to create clients." }
      }
      return { error: error.message }
    }
    return { error: "Failed to create client. Please try again." }
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

    const parsed = updateClientSchema.safeParse({
      name: formData.get("name"),
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
    })

    if (!parsed.success) {
      return {
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    await updateClientRecord(id, parsed.data)
    
    // Log activity
    await logClientActivity(
      id,
      "UPDATED",
      `Client "${parsed.data.name}" was updated`,
      session.user.id,
      session.user.name,
      parsed.data
    )
    
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
      return { error: error.message }
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

    await prisma.client.delete({ where: { id: clientId } })

    await logClientActivity(
      clientId,
      "DELETED",
      `Client "${client.name}" was deleted`,
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
      return { error: error.message }
    }
    return { error: "Failed to delete client. Please try again." }
  }
}
