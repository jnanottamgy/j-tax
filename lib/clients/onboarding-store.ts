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
  /** Name for the service when serviceType is OTHER. */
  customName?: string
  /**
   * Agreed fee per billing occurrence, excluding GST. Kept as a string because
   * it is bound straight to an input; "" means no fee agreed yet.
   */
  agreedFee: string
  /** The quotation line this fee came from, when converted from a quotation. */
  sourceQuotationItemId?: string
}

export type BasicInfo = {
  name: string
  companyName: string
  /** Entity-type code (see CLIENT_TYPE_OPTIONS); "" = not chosen. */
  clientType: string
  /** Free-text label when clientType is OTHER. */
  clientTypeCustom: string
  /** Whether the entity is already incorporated. Defaults true. */
  isIncorporated: boolean
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

/** Prefill payload used when converting an accepted quotation into a client. */
export type OnboardingPrefill = {
  basic?: Partial<BasicInfo>
  services?: Array<{
    serviceType: ServiceType
    frequency: ServiceFrequency
    customName?: string
    agreedFee?: number
    sourceQuotationItemId?: string
  }>
  sourceQuotationId?: string
  /** Set when onboarding straight from a lead with no accepted quotation. */
  sourceLeadId?: string
  /** When true, the services step is locked (must raise a new quotation to change). */
  lockServices?: boolean
}

type OnboardingState = {
  step: number
  basic: BasicInfo
  services: Partial<Record<ServiceType, OnboardingServiceConfig>>
  /** Document-checklist labels marked collected during onboarding. */
  collectedDocuments: string[]
  assignedEmployeeId: string
  priority: ClientPriority
  compliance: ComplianceSetup
  checklistReview: ChecklistReview
  /** Set when prefilled from a quotation — locks the services step. */
  lockedServices: boolean
  /** The quotation this onboarding was seeded from (marks it converted on save). */
  sourceQuotationId: string | null
  /** The lead this onboarding was seeded from (marks it converted on save). */
  sourceLeadId: string | null
  setStep: (step: number) => void
  updateBasic: (data: Partial<BasicInfo>) => void
  toggleService: (serviceType: ServiceType) => void
  toggleCollectedDocument: (label: string) => void
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
  hydrate: (prefill: OnboardingPrefill) => void
  reset: () => void
}

const emptyBasic: BasicInfo = {
  name: "",
  companyName: "",
  clientType: "",
  clientTypeCustom: "",
  isIncorporated: true,
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
      collectedDocuments: [],
      assignedEmployeeId: "",
      priority: "MEDIUM",
      compliance: emptyCompliance,
      checklistReview: emptyChecklistReview,
      lockedServices: false,
      sourceQuotationId: null,
      sourceLeadId: null,
      setStep: (step) => set({ step }),
      updateBasic: (data) =>
        set((state) => ({ basic: { ...state.basic, ...data } })),
      toggleCollectedDocument: (label) =>
        set((state) => ({
          collectedDocuments: state.collectedDocuments.includes(label)
            ? state.collectedDocuments.filter((l) => l !== label)
            : [...state.collectedDocuments, label],
        })),
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
              agreedFee: "",
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
      hydrate: (prefill) =>
        set(() => {
          const services: Partial<Record<ServiceType, OnboardingServiceConfig>> = {}
          for (const s of prefill.services ?? []) {
            services[s.serviceType] = {
              selected: true,
              frequency: s.frequency,
              nextDueDate: "",
              customName: s.customName,
              // The price the client accepted, carried through as the
              // engagement fee rather than being dropped at conversion.
              agreedFee: s.agreedFee != null && s.agreedFee > 0 ? String(s.agreedFee) : "",
              sourceQuotationItemId: s.sourceQuotationItemId,
            }
          }
          return {
            step: 0,
            basic: { ...emptyBasic, ...prefill.basic },
            services,
            collectedDocuments: [],
            assignedEmployeeId: "",
            priority: "MEDIUM",
            compliance: emptyCompliance,
            checklistReview: emptyChecklistReview,
            lockedServices: prefill.lockServices ?? false,
            sourceQuotationId: prefill.sourceQuotationId ?? null,
            sourceLeadId: prefill.sourceLeadId ?? null,
          }
        }),
      reset: () =>
        set({
          step: 0,
          basic: emptyBasic,
          services: {},
          collectedDocuments: [],
          assignedEmployeeId: "",
          priority: "MEDIUM",
          compliance: emptyCompliance,
          checklistReview: emptyChecklistReview,
          lockedServices: false,
          sourceQuotationId: null,
          sourceLeadId: null,
        }),
    }),
    {
      name: "j-tacs-client-onboarding",
      partialize: (state) => ({
        step: state.step,
        basic: state.basic,
        services: state.services,
        collectedDocuments: state.collectedDocuments,
        assignedEmployeeId: state.assignedEmployeeId,
        priority: state.priority,
        compliance: state.compliance,
        checklistReview: state.checklistReview,
        lockedServices: state.lockedServices,
        sourceQuotationId: state.sourceQuotationId,
        sourceLeadId: state.sourceLeadId,
      }),
    }
  )
)
