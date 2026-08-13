"use server"

import { revalidatePath } from "next/cache"
import { randomBytes } from "crypto"
import { requireAuth, requirePartnerOrManager } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"
import { upsertFirmSettings, extractDomain } from "@/lib/firm-settings"
import { validateGSTIN } from "@/lib/india/validators"

export async function getOnboardingStatus() {
  const session = await requireAuth()
  
  // Use upsert-style read: if no User record exists yet (new Supabase auth user),
  // return defaults rather than crashing the layout.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingCompleted: true,
      onboardingStep: true,
    },
  })

  return {
    completed: user?.onboardingCompleted ?? false,
    step: user?.onboardingStep ?? 0,
  }
}

export async function updateOnboardingStep(step: number) {
  const session = await requireAuth()
  
  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingStep: step },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as any,
      onboardingStep: step,
    },
  })

  revalidatePath("/")
  
  return { success: true }
}

export async function completeOnboarding() {
  const session = await requireAuth()

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingCompleted: true, onboardingStep: 6 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as any,
      onboardingCompleted: true,
      onboardingStep: 6,
    },
  })

  revalidatePath("/")

  return { success: true }
}

export async function skipOnboarding() {
  const session = await requireAuth()

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingCompleted: true, onboardingStep: 6 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as any,
      onboardingCompleted: true,
      onboardingStep: 6,
    },
  })

  revalidatePath("/")

  return { success: true }
}

export async function saveFirmInformation(data: {
  firmName: string
  gstin?: string
  pan?: string
  address?: string
  phone?: string
  email?: string
  replyToEmail?: string
  website?: string
  // Payment details print on invoices and drive the client portal's Pay
  // dialog — collected during onboarding so a firm's first invoice is payable.
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankIfsc?: string
  upiId?: string
}) {
  const session = await requireAuth()

  // Persist firm info to Supabase user_metadata for backward compat
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  await supabase.auth.updateUser({
    data: {
      firm_name: data.firmName?.trim() || null,
      firm_gstin: data.gstin?.trim() || null,
      firm_address: data.address?.trim() || null,
      firm_phone: data.phone?.trim() || null,
      firm_email: data.email?.trim() || null,
    },
  })

  // ── Firm-Branded Email System: persist to FirmSettings so outbound mail
  // immediately reflects this firm's identity. PARTNER only — Managers
  // setting up via the wizard wouldn't have permission to mutate firm config.
  if (session.user.role === "PARTNER" && data.firmName?.trim()) {
    try {
      const fromEmail = data.email?.trim() || ""
      const firmDomain = extractDomain(fromEmail)
      await upsertFirmSettings(
        {
          firmName: data.firmName.trim(),
          fromEmail,
          replyToEmail: data.replyToEmail?.trim() || data.email?.trim() || null,
          firmPhone: data.phone?.trim() || null,
          firmAddress: data.address?.trim() || null,
          gstin: data.gstin?.trim() || null,
          pan: data.pan?.trim() || null,
          website: data.website?.trim() || null,
          bankName: data.bankName?.trim() || null,
          bankAccountName: data.bankAccountName?.trim() || null,
          bankAccountNumber: data.bankAccountNumber?.trim() || null,
          bankIfsc: data.bankIfsc?.trim() || null,
          upiId: data.upiId?.trim() || null,
          firmDomain,
          // Domain verification is owned by the email provider and starts
          // fresh for a new sender domain — see lib/messaging/resend-domains.
          domainVerified: false,
          domainVerifiedAt: null,
          platformFallbackEnabled: true,
        },
        session.user.id
      )
    } catch (e) {
      // Surfaced, not swallowed: this used to fail silently, so a firm would
      // finish onboarding believing its details were saved while Settings and
      // every outbound email still showed the defaults.
      console.error("FirmSettings upsert from onboarding failed:", e)
      return {
        success: false,
        error:
          "Your firm details could not be saved. Please try again, or set them in Settings → Firm Details.",
      }
    }
  }

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingStep: 1 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingStep: 1,
    },
  })

  // Settings renders firm details server-side, so it must be revalidated too —
  // otherwise the page keeps serving the pre-onboarding cache and looks like
  // nothing was saved.
  revalidatePath("/")
  revalidatePath("/settings")

  return { success: true }
}

export async function saveEmployeeSetup(data: {
  employeeCount: number
  departments: string[]
}) {
  const session = await requireAuth()

  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  await supabase.auth.updateUser({
    data: {
      onboarding_employee_count: data.employeeCount,
      onboarding_departments: data.departments,
    },
  })

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingStep: 2 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingStep: 2,
    },
  })

  revalidatePath("/")
  return { success: true }
}

export async function saveServiceConfiguration(data: {
  services: string[]
  defaultReminderDays: number
}) {
  const session = await requireAuth()

  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  await supabase.auth.updateUser({
    data: {
      onboarding_services: data.services,
      onboarding_reminder_days: data.defaultReminderDays,
    },
  })

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingStep: 3 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingStep: 3,
    },
  })

  revalidatePath("/")
  return { success: true }
}

export async function saveClientImport(_data: {
  importMethod: "manual" | "csv"
  clientCount?: number
}) {
  const session = await requireAuth()

  // Client import method is informational only — no data to persist
  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingStep: 4 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingStep: 4,
    },
  })

  revalidatePath("/")
  return { success: true }
}

export async function saveNotificationPreferences(data: {
  emailEnabled: boolean
  smsEnabled: boolean
  whatsappEnabled: boolean
  reminderFrequency: string
}) {
  const session = await requireAuth()

  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  await supabase.auth.updateUser({
    data: {
      notification_email: data.emailEnabled,
      notification_sms: data.smsEnabled,
      notification_whatsapp: data.whatsappEnabled,
      notification_reminder_frequency: data.reminderFrequency,
    },
  })

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingStep: 5 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingStep: 5,
    },
  })

  revalidatePath("/")
  return { success: true }
}

export async function createEmployeeFromOnboarding(data: {
  name: string
  email: string
  department?: string
}): Promise<{ success: boolean; error?: string; employeeId?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, error: "Permission denied." }
  }

  if (!data.name?.trim() || !data.email?.trim()) {
    return { success: false, error: "Name and email are required." }
  }

  try {
    // Employee email is unique per firm now — findFirst is tenant-scoped.
    const existing = await prisma.employee.findFirst({ where: { email: data.email.trim() } })
    if (existing) {
      return { success: false, error: "An employee with this email already exists." }
    }

    const linkedUser = await prisma.user.findUnique({
      where: { email: data.email.trim() },
      select: { id: true },
    })

    const employee = await prisma.employee.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim(),
        department: data.department?.trim() || null,
        isActive: true,
        userId: linkedUser?.id ?? null,
      },
    })

    revalidatePath("/employees")
    return { success: true, employeeId: employee.id }
  } catch (error) {
    console.error("Failed to create employee during onboarding:", error)
    return { success: false, error: "Failed to create employee. Please try again." }
  }
}

export async function createClientFromOnboarding(data: {
  name: string
  email?: string
  phone?: string
  gstin?: string
}): Promise<{ success: boolean; error?: string; clientId?: string; clientName?: string }> {
  try {
    await requirePartnerOrManager()
  } catch {
    return { success: false, error: "Permission denied." }
  }

  if (!data.name?.trim()) {
    return { success: false, error: "Client name is required." }
  }

  // Same format rules as the main Add Client flow — this path previously
  // skipped validation entirely, letting unusable emails/GSTINs into the DB
  // (which then broke messaging sends downstream).
  const email = data.email?.trim() || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: `"${email}" is not a valid email address.` }
  }
  const phone = data.phone?.trim() || null
  if (phone && !/^[+]?[\d\s\-().]{7,20}$/.test(phone)) {
    return { success: false, error: `"${phone}" is not a valid phone number.` }
  }
  const gstin = data.gstin?.trim().toUpperCase() || null
  if (gstin) {
    const r = validateGSTIN(gstin)
    if (!r.valid) {
      return { success: false, error: `GSTIN "${gstin}": ${r.error}` }
    }
  }

  try {
    const count = await prisma.client.count()
    const clientCode = `CLI-${String(count + 1).padStart(4, "0")}`

    const client = await prisma.client.create({
      data: {
        name: data.name.trim(),
        clientCode,
        email,
        phone,
        gstin,
        status: "ACTIVE",
        priority: "MEDIUM",
      },
    })

    // Best-effort welcome email (no-op without an email; never throws).
    const { sendClientWelcomeEmail } = await import("@/lib/clients/welcome-email")
    await sendClientWelcomeEmail({ name: client.name, email: client.email })

    revalidatePath("/clients")
    return { success: true, clientId: client.id, clientName: client.name }
  } catch (error) {
    console.error("Failed to create client during onboarding:", error)
    return { success: false, error: "Failed to create client. Please try again." }
  }
}

export async function saveEmailConfiguration(data: {
  fromEmail?: string
  emailEnabled: boolean
  whatsappEnabled: boolean
  reminderFrequency: string
}) {
  const session = await requireAuth()

  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  await supabase.auth.updateUser({
    data: {
      notification_email: data.emailEnabled,
      notification_whatsapp: data.whatsappEnabled,
      notification_reminder_frequency: data.reminderFrequency,
      onboarding_from_email: data.fromEmail?.trim() || null,
    },
  })

  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingStep: 5 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingStep: 5,
    },
  })

  revalidatePath("/")
  return { success: true }
}
