import type { ClientStatus, Prisma } from "@prisma/client"

import type { AppRole } from "@/lib/auth/types"
import { buildOnboardingArtifacts } from "@/lib/clients/onboarding"
import type { ClientListItem, EmployeeOption } from "@/lib/clients/types"
import type {
  CreateClientInput,
  UpdateClientInput,
} from "@/lib/validations/client"
import { prisma } from "@/lib/prisma"

// MED-03: sequential code (matches seeded CLI-NNNN pattern) instead of Math.random()
async function generateClientCode(): Promise<string> {
  const count = await prisma.client.count()
  return `CLI-${String(count + 1).padStart(4, "0")}`
}

function mapClientToListItem(
  client: Prisma.ClientGetPayload<{
    include: {
      services: true
      assignedEmployee: true
      complianceSchedules: { orderBy: { dueDate: "asc" }; take: 1 }
    }
  }>
): ClientListItem {
  const nextSchedule = client.complianceSchedules[0]

  return {
    id: client.id,
    name: client.name,
    code: client.clientCode,
    gstin: client.gstin,
    pan: client.pan,
    email: client.email,
    phone: client.phone,
    whatsapp: client.whatsapp,
    address: client.address,
    notes: client.notes,
    assignedEmployeeId: client.assignedEmployeeId,
    assignedEmployee:
      client.assignedEmployee?.name ??
      client.assignedEmployeeName ??
      "Unassigned",
    status: client.status,
    priority: client.priority,
    services: client.services.map((service) => ({
      type: service.serviceType,
      frequency: service.frequency,
    })),
    nextDueDate: nextSchedule?.dueDate.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
  }
}

export async function listEmployees(): Promise<EmployeeOption[]> {
  return prisma.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, department: true },
  })
}

async function getVisibleClientWhere(opts?: {
  role?: AppRole
  userId?: string
}): Promise<Prisma.ClientWhereInput> {
  if (opts?.role !== "EMPLOYEE" || !opts.userId) {
    return {}
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: opts.userId },
    select: { id: true },
  })

  if (!employee) {
    return { id: "__no_visible_clients__" }
  }

  return { assignedEmployeeId: employee.id }
}

export async function listClients(opts?: {
  role?: AppRole
  userId?: string
}): Promise<ClientListItem[]> {
  const where = await getVisibleClientWhere(opts)

  const clients = await prisma.client.findMany({
    where,
    include: {
      services: { where: { isActive: true } },
      assignedEmployee: true,
      complianceSchedules: {
        where: { status: { in: ["SCHEDULED", "DUE"] } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return clients.map(mapClientToListItem)
}

export async function createClientWithOnboarding(
  input: CreateClientInput
): Promise<ClientListItem> {
  const clientCode = await generateClientCode()

  let assignedEmployeeName: string | undefined
  if (input.assignedEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.assignedEmployeeId },
    })
    assignedEmployeeName = employee?.name
  }

  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        clientCode,
        name: input.name,
        gstin: input.gstin,
        pan: input.pan,
        email: input.email,
        phone: input.phone,
        whatsapp: input.whatsapp,
        address: input.address,
        notes: input.notes,
        priority: input.priority,
        status: "PENDING",
        assignedEmployeeId: input.assignedEmployeeId,
        assignedEmployeeName,
      },
    })

    const artifacts = buildOnboardingArtifacts(
      created.id,
      created.name,
      input.services,
      {
        reminderDaysBefore: input.reminderDaysBefore,
        notificationPreferences: input.notificationPreferences,
      }
    )

    await tx.clientService.createMany({ data: artifacts.services })
    await tx.task.createMany({ data: artifacts.tasks })
    await tx.complianceSchedule.createMany({
      data: artifacts.complianceSchedules,
    })
    await tx.reminder.createMany({ data: artifacts.reminders })

    return tx.client.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        services: { where: { isActive: true } },
        assignedEmployee: true,
        complianceSchedules: {
          orderBy: { dueDate: "asc" },
          take: 1,
        },
      },
    })
  })

  return mapClientToListItem(client)
}

export async function getClientById(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      services: true,
      tasks: { orderBy: { dueDate: "asc" }, take: 5 },
      complianceSchedules: { orderBy: { dueDate: "asc" }, take: 5 },
      assignedEmployee: true,
    },
  })
}

export async function getClientDetail(
  id: string,
  opts?: { role?: AppRole; userId?: string }
) {
  const visibility = await getVisibleClientWhere(opts)

  return prisma.client.findFirst({
    where: { id, ...visibility },
    include: {
      services: true,
      tasks: { orderBy: { createdAt: "desc" } },
      complianceSchedules: { orderBy: { dueDate: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: { payments: true },
      },
      assignedEmployee: true,
      reminders: { orderBy: { dueAt: "asc" } },
    },
  })
}

export async function updateClient(id: string, data: UpdateClientInput) {
  let assignedEmployeeName: string | undefined | null = undefined;
  let assignedEmployeeUpdate: any = undefined;

  // Handle assignedEmployeeId to update the relation and the denormalized name
  if (data.assignedEmployeeId !== undefined) {
    if (data.assignedEmployeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: data.assignedEmployeeId },
      });
      assignedEmployeeName = employee?.name ?? null;
      assignedEmployeeUpdate = { connect: { id: data.assignedEmployeeId } };
    } else {
      assignedEmployeeName = null;
      assignedEmployeeUpdate = { disconnect: true };
    }
  }

  // Remove fields that are not columns on the Client model
  const { assignedEmployeeId, reminderDaysBefore, notificationPreferences, ...clientData } = data;

  return prisma.client.update({
    where: { id },
    data: {
      ...clientData,
      ...(assignedEmployeeName !== undefined && { assignedEmployeeName }),
      ...(assignedEmployeeUpdate !== undefined && { assignedEmployee: assignedEmployeeUpdate }),
    },
  });
}

export async function updateClientStatus(
  id: string,
  status: ClientStatus
): Promise<void> {
  await prisma.client.update({ where: { id }, data: { status } })
}

export async function deleteClient(clientId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.client.delete({ where: { id: clientId } });
    return { success: true };
  } catch (err: any) {
    if (err.code === 'P2025') {
      return { success: false, error: 'Client not found.' };
    }
    return { success: false, error: err.message };
  }
}

export async function seedEmployeesIfEmpty(): Promise<void> {
  const count = await prisma.employee.count()
  if (count > 0) return

  await prisma.employee.createMany({
    data: [
      {
        name: "Sarah Johnson",
        email: "sarah@jtax.io",
        department: "Partnership",
      },
      {
        name: "Michael Chen",
        email: "michael@jtax.io",
        department: "Tax Advisory",
      },
      {
        name: "Emily Rodriguez",
        email: "emily@jtax.io",
        department: "Compliance",
      },
      {
        name: "James Wilson",
        email: "james@jtax.io",
        department: "Operations",
      },
    ],
  })
}
