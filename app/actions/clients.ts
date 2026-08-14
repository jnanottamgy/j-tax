"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  requireAuth,
  requirePartnerOrManager,
} from "@/lib/auth/guards"
import {
  createClientWithOnboarding,
  findDuplicateClient,
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
import { GST_UNREGISTERED } from "@/lib/clients/gst-registration"
import { panFromGstin, stateCodeFromGstin } from "@/lib/clients/derive"
import { validateGSTIN } from "@/lib/india/validators"

export type ClientActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  /** Set when the add was blocked because a matching client already exists. */
  duplicate?: { clientId: string; clientName: string }
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

    // Block duplicates (same firm) with a clear message before hitting the DB.
    const dup = await findDuplicateClient({
      email: parsed.data.email,
      gstin: parsed.data.gstin,
      pan: parsed.data.pan,
    })
    if (dup) {
      const label = dup.field === "email" ? "email" : dup.field.toUpperCase()
      return {
        fieldErrors: { [dup.field]: [`Already used by "${dup.name}"`] },
        error: `A client "${dup.name}" already exists with this ${label}. Edit that client instead of creating a duplicate.`,
        duplicate: { clientId: dup.id, clientName: dup.name },
      }
    }

    const client = await createClientWithOnboarding(parsed.data)

    // Close the loop back to the pipeline. Best-effort: the client already
    // exists, so a bookkeeping failure here must not fail the onboarding.
    const sourceQuotationId = formData.get("sourceQuotationId")
    const sourceLeadId = formData.get("sourceLeadId")

    if (typeof sourceQuotationId === "string" && sourceQuotationId) {
      try {
        const { markQuotationConverted, markLeadConverted, getQuotationLeadId } =
          await import("@/app/actions/proposals")
        await markQuotationConverted(sourceQuotationId, client.id)
        // A quotation raised against a lead converts that lead too — otherwise
        // the lead keeps offering "Convert to Client" and a second, duplicate
        // client can be created from the same deal.
        const leadId = await getQuotationLeadId(sourceQuotationId)
        if (leadId) await markLeadConverted(leadId, client.id)
      } catch (convErr) {
        console.error("mark quotation converted failed:", convErr)
      }
    } else if (typeof sourceLeadId === "string" && sourceLeadId) {
      try {
        const { markLeadConverted } = await import("@/app/actions/proposals")
        await markLeadConverted(sourceLeadId, client.id)
      } catch (convErr) {
        console.error("mark lead converted failed:", convErr)
      }
    }

    // Best-effort welcome email (no-op without an email; never throws).
    const { sendClientWelcomeEmail } = await import("@/lib/clients/welcome-email")
    await sendClientWelcomeEmail({ name: client.name, email: client.email })

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

export type UnreachableClient = {
  id: string
  name: string
  clientCode: string
  phone: string | null
  assignedEmployeeName: string | null
  /** Deadlines in the next 30 days that will get no reminder. */
  upcomingDeadlines: number
  /** Unpaid invoices that will get no reminder. */
  openInvoices: number
}

/**
 * Active clients the app cannot email.
 *
 * Every automated client message goes by email, and every send site skips a
 * client without one — correctly, since a cron run must not die on one bad
 * row, but silently. A client with no email address quietly stops receiving
 * deadline reminders, invoice reminders and portal invitations, and the first
 * anyone hears of it is a late fee.
 *
 * The counts are the point: "no email" is a shrug, "no email and four
 * deadlines in the next month" is a job for someone this week.
 */
export async function getUnreachableClients(): Promise<UnreachableClient[]> {
  await requirePartnerOrManager()
  const { prisma } = await import("@/lib/prisma")

  const clients = await prisma.client.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      OR: [{ email: null }, { email: "" }],
    },
    select: {
      id: true,
      name: true,
      clientCode: true,
      phone: true,
      whatsapp: true,
      assignedEmployeeName: true,
    },
    orderBy: { name: "asc" },
  })
  if (clients.length === 0) return []

  const ids = clients.map((c) => c.id)
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 30)

  const [deadlines, invoices] = await Promise.all([
    prisma.complianceEvent.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: ids },
        status: { in: ["PENDING", "OVERDUE"] },
        dueDate: { lte: horizon },
      },
      _count: { _all: true },
    }),
    prisma.invoice.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: ids },
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        deletedAt: null,
      },
      _count: { _all: true },
    }),
  ])

  const deadlineBy = new Map(deadlines.map((d) => [d.clientId, d._count._all]))
  const invoiceBy = new Map(invoices.map((i) => [i.clientId, i._count._all]))

  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    clientCode: c.clientCode,
    // WhatsApp is a phone number too — it is what someone would actually dial.
    phone: c.phone ?? c.whatsapp ?? null,
    assignedEmployeeName: c.assignedEmployeeName,
    upcomingDeadlines: deadlineBy.get(c.id) ?? 0,
    openInvoices: invoiceBy.get(c.id) ?? 0,
  }))
}

/**
 * Record whether a client is registered under GST, from wherever the question
 * came up — in practice, the moment an invoice is being raised for them.
 *
 * Two answers, one action: a GSTIN, or "they are not registered". Both close
 * the gap; only the first changes what appears on the invoice. Saving the
 * GSTIN also fills in the PAN and state code it encodes, because re-typing
 * facts the GSTIN already contains is how they end up inconsistent.
 */
export async function setClientGstRegistration(
  clientId: string,
  input: { gstin: string } | { unregistered: true }
): Promise<{ success?: boolean; error?: string; gstin?: string | null }> {
  try {
    const session = await requirePartnerOrManager()
    const { prisma } = await import("@/lib/prisma")

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, pan: true, stateCode: true },
    })
    if (!client) return { error: "Client not found." }

    if ("unregistered" in input) {
      await prisma.client.update({
        where: { id: clientId },
        data: { gstRegistration: GST_UNREGISTERED },
      })
      await logClientActivity(
        clientId,
        "UPDATED",
        `${client.name} recorded as not registered under GST`,
        session.user.id,
        session.user.name
      )
      revalidatePath("/clients")
      revalidatePath(`/clients/${clientId}`)
      return { success: true, gstin: null }
    }

    const gstin = input.gstin.trim().toUpperCase()
    const check = validateGSTIN(gstin)
    if (!check.valid) {
      return { error: check.error ?? "That does not look like a valid GSTIN." }
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        gstin,
        // A GSTIN carries the PAN and the state; only fill blanks, never
        // overwrite something a person entered deliberately.
        ...(client.pan ? {} : { pan: panFromGstin(gstin) ?? undefined }),
        ...(client.stateCode ? {} : { stateCode: stateCodeFromGstin(gstin) ?? undefined }),
        // The registration question is settled by the GSTIN itself now.
        gstRegistration: null,
      },
    })

    await logClientActivity(
      clientId,
      "UPDATED",
      `GSTIN ${gstin} added to ${client.name}`,
      session.user.id,
      session.user.name
    )

    revalidatePath("/clients")
    revalidatePath(`/clients/${clientId}`)
    return { success: true, gstin }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return { error: "You do not have permission to edit clients." }
    }
    return { error: toUserError(error) }
  }
}
