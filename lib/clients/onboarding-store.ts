"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  ClientPriority,
  ServiceFrequency,
  ServiceType,
} from "@prisma/client"

export type OnboardingServiceConfig = {
  selected: boolean
  frequency: ServiceFrequency
  nextDueDate: string
}

type BasicInfo = {
  name: string
  gstin: string
  pan: string
  email: string
  phone: string
  whatsapp: string
  address: string
  notes: string
}

type ComplianceSetup = {
  reminderDaysBefore: string
  notifyEmail: boolean
  notifyWhatsApp: boolean
  notifyDashboard: boolean
}

type ChecklistReview = {
  reviewed: boolean
}

type OnboardingState = {
  step: number
  basic: BasicInfo
  services: Partial<Record<ServiceType, OnboardingServiceConfig>>
  assignedEmployeeId: string
  priority: ClientPriority
  compliance: ComplianceSetup
  checklistReview: ChecklistReview
  setStep: (step: number) => void
  updateBasic: (data: Partial<BasicInfo>) => void
  toggleService: (serviceType: ServiceType) => void
  updateService: (
    serviceType: ServiceType,
    data: Partial<OnboardingServiceConfig>
  ) => void
  updateAssignment: (data: {
    assignedEmployeeId?: string
    priority?: ClientPriority
  }) => void
  updateCompliance: (data: Partial<ComplianceSetup>) => void
  updateChecklistReview: (data: Partial<ChecklistReview>) => void
  reset: () => void
}

const emptyBasic: BasicInfo = {
  name: "",
  gstin: "",
  pan: "",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  notes: "",
}

const emptyCompliance: ComplianceSetup = {
  reminderDaysBefore: "7",
  notifyEmail: true,
  notifyWhatsApp: false,
  notifyDashboard: true,
}

const emptyChecklistReview: ChecklistReview = {
  reviewed: false,
}

export const useClientOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      step: 0,
      basic: emptyBasic,
      services: {},
      assignedEmployeeId: "",
      priority: "MEDIUM",
      compliance: emptyCompliance,
      checklistReview: emptyChecklistReview,
      setStep: (step) => set({ step }),
      updateBasic: (data) =>
        set((state) => ({ basic: { ...state.basic, ...data } })),
      toggleService: (serviceType) =>
        set((state) => {
          const current = state.services[serviceType]
          const services = { ...state.services }

          if (current?.selected) {
            delete services[serviceType]
          } else {
            services[serviceType] = {
              selected: true,
              frequency: "MONTHLY",
              nextDueDate: "",
            }
          }

          return { services }
        }),
      updateService: (serviceType, data) =>
        set((state) => ({
          services: {
            ...state.services,
            [serviceType]: {
              selected: true,
              frequency: "MONTHLY",
              nextDueDate: "",
              ...state.services[serviceType],
              ...data,
            },
          },
        })),
      updateAssignment: (data) => set(data),
      updateCompliance: (data) =>
        set((state) => ({
          compliance: { ...state.compliance, ...data },
        })),
      updateChecklistReview: (data) =>
        set((state) => ({
          checklistReview: { ...state.checklistReview, ...data },
        })),
      reset: () =>
        set({
          step: 0,
          basic: emptyBasic,
          services: {},
          assignedEmployeeId: "",
          priority: "MEDIUM",
          compliance: emptyCompliance,
          checklistReview: emptyChecklistReview,
        }),
    }),
    {
      name: "j-tacs-client-onboarding",
      partialize: (state) => ({
        step: state.step,
        basic: state.basic,
        services: state.services,
        assignedEmployeeId: state.assignedEmployeeId,
        priority: state.priority,
        compliance: state.compliance,
        checklistReview: state.checklistReview,
      }),
    }
  )
)
