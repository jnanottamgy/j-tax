"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth/guards"
import { prisma } from "@/lib/prisma"

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
    update: { onboardingCompleted: true, onboardingStep: 5 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as any,
      onboardingCompleted: true,
      onboardingStep: 5,
    },
  })

  revalidatePath("/")
  
  return { success: true }
}

export async function skipOnboarding() {
  const session = await requireAuth()
  
  await prisma.user.upsert({
    where: { id: session.user.id },
    update: { onboardingCompleted: true, onboardingStep: 5 },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role as any,
      onboardingCompleted: true,
      onboardingStep: 5,
    },
  })

  revalidatePath("/")
  
  return { success: true }
}

export async function saveFirmInformation(data: {
  firmName: string
  gstin?: string
  address?: string
  phone?: string
  email?: string
}) {
  const session = await requireAuth()

  // Persist firm info to Supabase user_metadata (no schema change required)
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

  revalidatePath("/")

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
    update: { onboardingStep: 5, onboardingCompleted: true },
    create: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      onboardingStep: 5,
      onboardingCompleted: true,
    },
  })

  revalidatePath("/")
  return { success: true }
}
