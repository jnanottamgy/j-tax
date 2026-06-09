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
  
  // Store firm information in a separate Firm model or as metadata
  // For now, we'll update the onboarding step
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

export async function saveClientImport(data: {
  importMethod: "manual" | "csv"
  clientCount?: number
}) {
  const session = await requireAuth()
  
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
  
  await prisma.user.upsert({
    where: { id: session.user.id },
    update: {
      onboardingStep: 5,
      onboardingCompleted: true,
    },
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
