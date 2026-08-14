import type { ClientStatus, Prisma } from "@prisma/client"

import type { AppRole } from "@/lib/auth/types"
import { buildOnboardingArtifacts, calculateNextDueDate } from "@/lib/clients/onboarding"
import type { ClientListItem, EmployeeOption } from "@/lib/clients/types"
import type {
  CreateClientInput,
  UpdateClientInput,
} from "@/lib/validations/client"
import { panFromGstin, stateCodeFromGstin } from "@/lib/clients/derive"
import { prisma } from "@/lib/prisma"

async function generateClientCode(tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const db = tx ?? prisma
  const count = await db.client.count()
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
    companyName: client.companyName,
    clientType: client.entityType,
    clientTypeCustom: client.entityTypeCustom,
    isIncorporated: client.isIncorporated,
    code: client.clientCode,
    gstin: client.gstin,
    gstRegistration: client.gstRegistration,
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
    fyEndMonth: client.fyEndMonth,
    annualTurnover: client.annualTurnover != null ? Number(client.annualTurnover) : null,
    turnoverFy: client.turnoverFy,
    gstFilingScheme: client.gstFilingScheme,
    services: client.services.map((service) => ({
      type: service.serviceType,
      frequency: service.frequency,
      customName: service.customName,
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

/**
 * Find an existing (non-deleted, same-firm) client that collides with the given
 * email / GSTIN / PAN. Runs through the tenant-scoped client, so it's per-firm
 * and excludes recycled rows automatically. Used to block duplicate adds with a
 * friendly message before we ever hit a DB unique-constraint error.
 */
export async function findDuplicateClient(input: {
  email?: string
  gstin?: string
  pan?: string
}): Promise<{ id: string; name: string; field: "email" | "gstin" | "pan" } | null> {
  const or: Prisma.ClientWhereInput[] = []
  if (input.email) or.push({ email: { equals: input.email, mode: "insensitive" } })
  if (input.gstin) or.push({ gstin: input.gstin })
  if (input.pan) or.push({ pan: input.pan })
  if (or.length === 0) return null

  const existing = await prisma.client.findFirst({
    where: { OR: or },
    select: { id: true, name: true, email: true, gstin: true, pan: true },
  })
  if (!existing) return null

  const field: "email" | "gstin" | "pan" =
    input.email && existing.email?.toLowerCase() === input.email.toLowerCase()
      ? "email"
      : input.gstin && existing.gstin === input.gstin
        ? "gstin"
        : "pan"
  return { id: existing.id, name: existing.name, field }
}

export async function createClientWithOnboarding(
  input: CreateClientInput
): Promise<ClientListItem> {
  let assignedEmployeeName: string | undefined
  if (input.assignedEmployeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: input.assignedEmployeeId },
    })
    assignedEmployeeName = employee?.name
  }

  const client = await prisma.$transaction(async (tx) => {
    // Generate client code inside the transaction to avoid race conditions
    const clientCode = await generateClientCode(tx)

    const created = await tx.client.create({
      data: {
        clientCode,
        name: input.name,
        companyName: input.companyName,
        entityType: input.clientType || undefined,
        entityTypeCustom:
          input.clientType === "OTHER" ? input.clientTypeCustom : undefined,
        isIncorporated: input.isIncorporated,
        gstin: input.gstin,
        // Derived server-side too, not just in the form: the CSV importer and
        // the quotation-conversion path both land here without going through a
        // field the browser could fill in.
        pan: input.pan || panFromGstin(input.gstin) || undefined,
        stateCode: stateCodeFromGstin(input.gstin) ?? undefined,
        // Accounting year and scale. Turnover is what lets the compliance
        // engine pick the right GST cadence instead of assuming monthly.
        fyEndMonth: input.fyEndMonth ?? 3,
        annualTurnover: input.annualTurnover ?? null,
        turnoverFy: input.turnoverFy ?? null,
        gstFilingScheme: input.gstFilingScheme ?? null,
        email: input.email,
        phone: input.phone,
        whatsapp: input.whatsapp,
        address: input.address,
        notes: input.notes,
        priority: input.priority,
        // ACTIVE, not PENDING.
        //
        // generateRecurringComplianceTasks() only queries clients with
        // status ACTIVE, so every client created here used to be skipped by the
        // compliance engine forever — no error, no empty state, just no filings
        // ever generated. A firm that genuinely wants a client paused has
        // ON_HOLD and INACTIVE; PENDING was never a choice anyone made, it was
        // the column default leaking into the product.
        status: "ACTIVE",
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
        collectedDocuments: input.collectedDocuments,
        assignedEmployeeId: input.assignedEmployeeId ?? null,
      }
    )

    await tx.clientService.createMany({ data: artifacts.services })
    await tx.task.createMany({ data: artifacts.tasks })
    await tx.complianceSchedule.createMany({
      data: artifacts.complianceSchedules,
    })
    await tx.reminder.createMany({ data: artifacts.reminders })
    await tx.clientDocumentChecklistItem.createMany({
      data: artifacts.documentChecklist,
    })

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

  // Billing stays with Partner/Manager. EMPLOYEE is blocked from /payments,
  // getInvoicesData and the invoice PDF, so this detail payload — reachable via
  // getClientProfile and GET /api/clients/[id] — must not hand them the
  // invoice ledger and payment receipts for their assigned clients either.
  const canSeeBilling = opts?.role === "PARTNER" || opts?.role === "MANAGER"

  return prisma.client.findFirst({
    where: { id, ...visibility },
    include: {
      services: true,
      documentChecklist: { orderBy: [{ collected: "asc" }, { createdAt: "asc" }] },
      tasks: { orderBy: { createdAt: "desc" } },
      complianceSchedules: { orderBy: { dueDate: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      invoices: canSeeBilling
        ? {
            orderBy: { createdAt: "desc" as const },
            include: { payments: true },
          }
        : { where: { id: "__billing_hidden__" } },
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

  // Remove fields that are not scalar columns on the Client model. clientType /
  // clientTypeCustom map onto the DB columns entityType / entityTypeCustom.
  const {
    assignedEmployeeId: _assignedEmployeeId,
    reminderDaysBefore: _reminderDaysBefore,
    notificationPreferences: _notificationPreferences,
    clientType,
    clientTypeCustom,
    services,
    ...clientData
  } = data;

  // Re-derive on every save. A client whose GSTIN is corrected — or added
  // for the first time — gets the right place of supply on their next invoice
  // without anyone remembering to update a second field.
  const derivedState = stateCodeFromGstin(clientData.gstin)

  const clientUpdateData = {
    ...clientData,
    ...(derivedState ? { stateCode: derivedState } : {}),
    ...(clientType !== undefined && { entityType: clientType || null }),
    entityTypeCustom: clientType === "OTHER" ? clientTypeCustom ?? null : null,
    ...(assignedEmployeeName !== undefined && { assignedEmployeeName }),
    ...(assignedEmployeeUpdate !== undefined && { assignedEmployee: assignedEmployeeUpdate }),
  };

  // No service edits → plain scalar update.
  if (services === undefined) {
    return prisma.client.update({ where: { id }, data: clientUpdateData });
  }

  // Service edits → update scalars + reconcile ClientService rows atomically.
  // Kept/added services are upserted (frequency + OTHER name, reactivated);
  // services no longer selected are deactivated (isActive:false) rather than
  // deleted, so history — and the unique (clientId, serviceType) row — survive.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({ where: { id }, data: clientUpdateData });

    for (const svc of services) {
      const customName = svc.serviceType === "OTHER" ? svc.customName ?? null : null;
      // A fee is only written when one was supplied. `undefined` means the
      // caller isn't touching commercial terms — a form that edits frequency
      // must not silently wipe the agreed fee off the engagement.
      const hasFee = typeof svc.agreedFee === "number" && svc.agreedFee > 0;
      const feeFields = hasFee
        ? { agreedFee: svc.agreedFee, feeAgreedAt: new Date() }
        : {};

      await tx.clientService.upsert({
        where: { clientId_serviceType: { clientId: id, serviceType: svc.serviceType } },
        create: {
          clientId: id,
          serviceType: svc.serviceType,
          customName,
          frequency: svc.frequency,
          isActive: true,
          nextDueDate: svc.nextDueDate
            ? new Date(svc.nextDueDate)
            : calculateNextDueDate(svc.frequency),
          billingFrequency: svc.billingFrequency ?? null,
          sourceQuotationItemId: svc.sourceQuotationItemId ?? null,
          ...feeFields,
        },
        update: {
          frequency: svc.frequency,
          customName,
          isActive: true,
          ...(svc.billingFrequency !== undefined
            ? { billingFrequency: svc.billingFrequency }
            : {}),
          ...feeFields,
        },
      });
    }

    const keep = services.map((s) => s.serviceType);
    await tx.clientService.updateMany({
      where: { clientId: id, isActive: true, serviceType: { notIn: keep } },
      data: { isActive: false },
    });

    return updated;
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

