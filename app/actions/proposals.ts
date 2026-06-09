"use server"

import { randomBytes } from "crypto"
import { revalidatePath } from "next/cache"
import { addDays } from "date-fns"
import { z } from "zod"

import { requireAuth, requirePartner, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { toUserError } from "@/lib/forms/errors"
import { notificationService } from "@/lib/messaging/notification-service"
import {
  quotationEmailHTML,
  followUpEmailHTML,
  quotationSubject,
  followUpSubject,
  type QuotationEmailVars,
} from "@/lib/quotations/email-templates"

const FIRM_NAME = process.env.FIRM_NAME || "TaxWise Consultants"
const FIRM_EMAIL = process.env.FROM_EMAIL || "noreply@taxwiseconsultants.com"
const FIRM_PHONE = process.env.FIRM_PHONE || "+91-XXXXXXXXXX"
const FIRM_ADDRESS = process.env.FIRM_ADDRESS || "India"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// ─── Lead Actions ─────────────────────────────────────────────────────────────

const leadSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  company: z.string().optional(),
  serviceRequired: z.string().optional(),
  source: z.enum(["REFERRAL", "WEBSITE", "WALK_IN", "COLD_CALL", "SOCIAL_MEDIA", "OTHER"]).default("OTHER"),
  estimatedValue: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
})

export type LeadActionState = { success?: boolean; error?: string; fieldErrors?: Record<string, string[]> }

export async function createLead(_prev: LeadActionState, formData: FormData): Promise<LeadActionState> {
  try {
    const session = await requirePartnerOrManager()
    const parsed = leadSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    await prisma.lead.create({
      data: {
        ...parsed.data,
        estimatedValue: parsed.data.estimatedValue ?? null,
        phone: parsed.data.phone || null,
        company: parsed.data.company || null,
        serviceRequired: parsed.data.serviceRequired || null,
        notes: parsed.data.notes || null,
        assignedTo: parsed.data.assignedTo || null,
        createdBy: session.user.id,
      },
    })

    revalidatePath("/proposals")
    return { success: true }
  } catch (err) {
    return { error: toUserError(err) }
  }
}

export async function updateLead(
  leadId: string,
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  try {
    await requirePartnerOrManager()
    const parsed = leadSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

    const statusRaw = formData.get("status")
    const status = statusRaw && ["NEW_LEAD","CONTACTED","PROPOSAL_SENT","NEGOTIATION","WON","LOST"].includes(String(statusRaw))
      ? (String(statusRaw) as "NEW_LEAD"|"CONTACTED"|"PROPOSAL_SENT"|"NEGOTIATION"|"WON"|"LOST")
      : undefined

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...parsed.data,
        estimatedValue: parsed.data.estimatedValue ?? null,
        phone: parsed.data.phone || null,
        company: parsed.data.company || null,
        serviceRequired: parsed.data.serviceRequired || null,
        notes: parsed.data.notes || null,
        assignedTo: parsed.data.assignedTo || null,
        ...(status ? { status } : {}),
      },
    })

    revalidatePath("/proposals")
    return { success: true }
  } catch (err) {
    return { error: toUserError(err) }
  }
}

export async function updateLeadStatus(leadId: string, status: string) {
  try {
    await requirePartnerOrManager()
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: status as "NEW_LEAD"|"CONTACTED"|"PROPOSAL_SENT"|"NEGOTIATION"|"WON"|"LOST" },
    })
    revalidatePath("/proposals")
    return { success: true }
  } catch (err) {
    return { error: toUserError(err) }
  }
}

export async function deleteLead(leadId: string) {
  try {
    await requirePartnerOrManager()
    await prisma.lead.delete({ where: { id: leadId } })
    revalidatePath("/proposals")
    return { success: true }
  } catch (err) {
    return { error: toUserError(err) }
  }
}

export async function getLeads(filters?: { status?: string; search?: string }) {
  await requirePartnerOrManager()

  const where: Record<string, unknown> = {}
  if (filters?.status && filters.status !== "ALL") where.status = filters.status
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { company: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  const leads = await prisma.lead.findMany({
    where,
    include: { quotations: { select: { id: true, status: true, total: true } } },
    orderBy: { createdAt: "desc" },
  })

  return leads
}

// ─── Quotation Actions ────────────────────────────────────────────────────────

const itemSchema = z.object({
  description: z.string().min(1),
  serviceType: z.string().optional(),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100).default(18),
})

export type QuotationActionState = { success?: boolean; error?: string; quotationId?: string; fieldErrors?: Record<string, string[]> }

export async function createQuotation(
  _prev: QuotationActionState,
  formData: FormData
): Promise<QuotationActionState> {
  try {
    const session = await requirePartnerOrManager()

    const clientName = String(formData.get("clientName") || "").trim()
    const clientEmail = String(formData.get("clientEmail") || "").trim()
    const clientPhone = String(formData.get("clientPhone") || "").trim() || null
    const clientCompany = String(formData.get("clientCompany") || "").trim() || null
    const validUntilRaw = String(formData.get("validUntil") || "")
    const notes = String(formData.get("notes") || "").trim() || null
    const terms = String(formData.get("terms") || "").trim() || null
    const leadId = String(formData.get("leadId") || "").trim() || null
    const itemsRaw = String(formData.get("items") || "[]")

    if (!clientName || !clientEmail || !validUntilRaw) {
      return { error: "Client name, email, and valid-until date are required." }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return { error: "Invalid email address." }
    }

    let items: z.infer<typeof itemSchema>[]
    try {
      const raw = JSON.parse(itemsRaw)
      const parsed = z.array(itemSchema).safeParse(raw)
      if (!parsed.success) return { error: "Invalid line items." }
      items = parsed.data
      if (items.length === 0) return { error: "At least one line item is required." }
    } catch {
      return { error: "Invalid items data." }
    }

    // Compute totals
    let subtotal = 0
    let totalTax = 0
    const computedItems = items.map((item, idx) => {
      const lineSubtotal = item.quantity * item.unitPrice
      const lineTax = (lineSubtotal * item.taxRate) / 100
      subtotal += lineSubtotal
      totalTax += lineTax
      return { ...item, taxAmount: lineTax, total: lineSubtotal + lineTax, sortOrder: idx }
    })
    const total = subtotal + totalTax

    // Generate unique quotation number and token
    const count = await prisma.quotation.count()
    const quotationNumber = `QT-${String(count + 1).padStart(5, "0")}`
    const token = randomBytes(32).toString("hex")

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        token,
        leadId,
        clientName,
        clientEmail,
        clientPhone,
        clientCompany,
        validUntil: new Date(validUntilRaw),
        notes,
        terms,
        subtotal,
        taxAmount: totalTax,
        total,
        createdBy: session.user.id,
        status: session.user.role === "PARTNER" ? "APPROVED" : "PENDING_APPROVAL",
        items: {
          create: computedItems.map((item) => ({
            description: item.description,
            serviceType: item.serviceType || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            total: item.total,
            sortOrder: item.sortOrder,
          })),
        },
      },
    })

    // If lead exists, update its status
    if (leadId) {
      await prisma.lead.update({ where: { id: leadId }, data: { status: "PROPOSAL_SENT" } })
    }

    // Notify Partners if PENDING_APPROVAL
    if (session.user.role !== "PARTNER") {
      const partners = await prisma.user.findMany({ where: { role: "PARTNER" } })
      await prisma.notification.createMany({
        data: partners.map((p) => ({
          userId: p.id,
          title: "Quotation Pending Approval",
          message: `${session.user.name} created Quotation #${quotationNumber} for ${clientName} — ₹${total.toLocaleString("en-IN")}. Review and approve to send.`,
          type: "INFO" as const,
        })),
      })
    }

    revalidatePath("/proposals")
    return { success: true, quotationId: quotation.id }
  } catch (err) {
    return { error: toUserError(err) }
  }
}

export async function approveAndSendQuotation(quotationId: string): Promise<QuotationActionState> {
  try {
    const session = await requirePartner()

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    })

    if (!quotation) return { error: "Quotation not found." }
    if (!["PENDING_APPROVAL", "APPROVED", "DRAFT"].includes(quotation.status)) {
      return { error: "Quotation cannot be sent in its current state." }
    }

    const viewUrl = `${APP_URL}/q/${quotation.token}`

    const emailVars: QuotationEmailVars = {
      firmName: FIRM_NAME,
      firmEmail: FIRM_EMAIL,
      clientName: quotation.clientName,
      quotationNumber: quotation.quotationNumber,
      total: `₹${Number(quotation.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      validUntil: new Date(quotation.validUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      viewUrl,
      items: quotation.items.map((i) => ({
        description: i.description,
        total: `₹${Number(i.total).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      })),
      subtotal: `₹${Number(quotation.subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      taxAmount: `₹${Number(quotation.taxAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      notes: quotation.notes || undefined,
    }

    const result = await notificationService.send({
      channel: "email",
      to: quotation.clientEmail,
      subject: quotationSubject(quotation.quotationNumber, FIRM_NAME),
      content: quotationEmailHTML(emailVars),
    })

    const now = new Date()

    await prisma.$transaction([
      prisma.quotation.update({
        where: { id: quotationId },
        data: {
          status: "SENT",
          approvedBy: session.user.id,
          approvedAt: now,
          sentAt: now,
        },
      }),
      prisma.quotationEmailLog.create({
        data: {
          quotationId,
          resendId: result.messageId || null,
          emailType: "INITIAL",
          to: quotation.clientEmail,
          subject: quotationSubject(quotation.quotationNumber, FIRM_NAME),
          status: result.success ? "SENT" : "FAILED",
        },
      }),
    ])

    // Schedule follow-ups (Day 3, 7, 14)
    if (result.success) {
      await prisma.quotationFollowUp.createMany({
        data: [3, 7, 14].map((day) => ({
          quotationId,
          followUpDay: day,
          scheduledAt: addDays(now, day),
          status: "PENDING",
        })),
      })
    }

    // Update lead status
    if (quotation.leadId) {
      await prisma.lead.update({ where: { id: quotation.leadId }, data: { status: "PROPOSAL_SENT" } })
    }

    revalidatePath("/proposals")
    revalidatePath(`/proposals/quotations/${quotationId}`)
    return { success: true }
  } catch (err) {
    return { error: toUserError(err) }
  }
}

export async function getQuotations(filters?: { status?: string; search?: string }) {
  await requirePartnerOrManager()

  const where: Record<string, unknown> = {}
  if (filters?.status && filters.status !== "ALL") where.status = filters.status
  if (filters?.search) {
    where.OR = [
      { clientName: { contains: filters.search, mode: "insensitive" } },
      { clientEmail: { contains: filters.search, mode: "insensitive" } },
      { quotationNumber: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  return prisma.quotation.findMany({
    where,
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      emailLogs: { orderBy: { sentAt: "desc" }, take: 5 },
      lead: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getQuotationById(id: string) {
  await requirePartnerOrManager()
  return prisma.quotation.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      emailLogs: { orderBy: { sentAt: "desc" } },
      followUps: { orderBy: { scheduledAt: "asc" } },
      lead: true,
    },
  })
}

export async function deleteQuotation(quotationId: string) {
  try {
    await requirePartnerOrManager()
    const q = await prisma.quotation.findUnique({ where: { id: quotationId } })
    if (!q) return { error: "Quotation not found." }
    if (["SENT", "ACCEPTED"].includes(q.status)) return { error: "Cannot delete a sent or accepted quotation." }
    await prisma.quotation.delete({ where: { id: quotationId } })
    revalidatePath("/proposals")
    return { success: true }
  } catch (err) {
    return { error: toUserError(err) }
  }
}

// ─── Public: Client responds to quotation ────────────────────────────────────

export async function respondToQuotation(
  token: string,
  response: "ACCEPTED" | "REJECTED",
  rejectionReason?: string
) {
  const quotation = await prisma.quotation.findUnique({ where: { token } })
  if (!quotation) return { error: "Quotation not found." }
  if (!["SENT", "VIEWED"].includes(quotation.status)) {
    return { error: "This quotation is no longer available for a response." }
  }

  const now = new Date()
  await prisma.quotation.update({
    where: { id: quotation.id },
    data: {
      status: response,
      respondedAt: now,
      rejectionReason: response === "REJECTED" ? (rejectionReason || null) : null,
    },
  })

  // Update lead status
  if (quotation.leadId) {
    await prisma.lead.update({
      where: { id: quotation.leadId },
      data: { status: response === "ACCEPTED" ? "WON" : "NEGOTIATION" },
    })
  }

  // Skip pending follow-ups
  await prisma.quotationFollowUp.updateMany({
    where: { quotationId: quotation.id, status: "PENDING" },
    data: { status: "SKIPPED" },
  })

  // Notify partners
  const partners = await prisma.user.findMany({ where: { role: "PARTNER" } })
  const statusVerb = response === "ACCEPTED" ? "✅ ACCEPTED" : "❌ Rejected"
  await prisma.notification.createMany({
    data: partners.map((p) => ({
      userId: p.id,
      title: `Quotation ${statusVerb}`,
      message: `${quotation.clientName} ${response === "ACCEPTED" ? "accepted" : "rejected"} Quotation #${quotation.quotationNumber} (₹${Number(quotation.total).toLocaleString("en-IN")}).`,
      type: response === "ACCEPTED" ? ("INFO" as const) : ("WARNING" as const),
    })),
  })

  revalidatePath("/proposals")
  return { success: true }
}

export async function markQuotationViewed(token: string) {
  const q = await prisma.quotation.findUnique({ where: { token } })
  if (!q || q.status !== "SENT") return
  await prisma.quotation.update({
    where: { id: q.id },
    data: { status: "VIEWED", viewedAt: new Date() },
  })
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getProposalAnalytics() {
  await requirePartnerOrManager()

  const [
    totalLeads,
    leadsByStatus,
    totalQuotations,
    quotationsByStatus,
    acceptedQuotations,
    totalRevenuePipeline,
    wonRevenue,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.quotation.count(),
    prisma.quotation.groupBy({ by: ["status"], _count: true }),
    prisma.quotation.findMany({
      where: { status: "ACCEPTED" },
      select: { total: true },
    }),
    prisma.quotation.aggregate({
      where: { status: { in: ["SENT", "VIEWED", "PENDING_APPROVAL", "APPROVED"] } },
      _sum: { total: true },
    }),
    prisma.quotation.aggregate({
      where: { status: "ACCEPTED" },
      _sum: { total: true },
    }),
  ])

  const sent = quotationsByStatus.find((s) => ["SENT", "VIEWED"].includes(s.status as string))?._count ?? 0
  const accepted = quotationsByStatus.find((s) => s.status === "ACCEPTED")?._count ?? 0
  const rejected = quotationsByStatus.find((s) => s.status === "REJECTED")?._count ?? 0
  const responded = accepted + rejected
  const acceptanceRate = responded > 0 ? Math.round((accepted / responded) * 100) : 0

  const avgDealSize =
    acceptedQuotations.length > 0
      ? acceptedQuotations.reduce((sum, q) => sum + Number(q.total), 0) / acceptedQuotations.length
      : 0

  const wonLeads = leadsByStatus.find((l) => l.status === "WON")?._count ?? 0
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0

  return {
    totalLeads,
    leadsByStatus: Object.fromEntries(leadsByStatus.map((l) => [l.status, l._count])),
    totalQuotations,
    quotationsByStatus: Object.fromEntries(quotationsByStatus.map((q) => [q.status, q._count])),
    acceptanceRate,
    conversionRate,
    avgDealSize,
    revenuePipeline: Number(totalRevenuePipeline._sum.total ?? 0),
    wonRevenue: Number(wonRevenue._sum.total ?? 0),
  }
}
