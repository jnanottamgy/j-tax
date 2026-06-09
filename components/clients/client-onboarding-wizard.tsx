"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  Loader2,
  Plus,
  Save,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react"
import type { ClientPriority, ServiceFrequency, ServiceType } from "@prisma/client"
import { toast } from "sonner"

import {
  createClient,
  type ClientActionState,
} from "@/app/actions/clients"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ALL_CLIENT_PRIORITIES,
  CLIENT_PRIORITY_LABELS,
  SERVICE_FREQUENCY_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/clients/constants"
import { buildDocumentChecklist } from "@/lib/clients/onboarding"
import {
  useClientOnboardingStore,
  type OnboardingServiceConfig,
} from "@/lib/clients/onboarding-store"
import type { EmployeeOption } from "@/lib/clients/types"
import { cn } from "@/lib/utils"

const initialState: ClientActionState = {}
const serviceOptions: ServiceType[] = [
  "GST_RETURN",
  "TDS",
  "COMPANY_LAW",
  "BOOKKEEPING",
  "AUDIT",
  "INCOME_TAX",
  "OTHER",
]

const steps = [
  { title: "Basic Information", icon: UserRound },
  { title: "Services Selection", icon: ClipboardList },
  { title: "Service Configuration", icon: Settings2 },
  { title: "Document Checklist", icon: FileCheck2 },
  { title: "Compliance Setup", icon: Bell },
]

type ClientOnboardingWizardProps = {
  employees: EmployeeOption[]
  onSuccess?: () => void
}

export function ClientOnboardingWizard({
  employees,
  onSuccess,
}: ClientOnboardingWizardProps) {
  const [open, setOpen] = useState(false)
  const [showDraftSaved, setShowDraftSaved] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const [state, formAction, isPending] = useActionState(
    createClient,
    initialState
  )
  const {
    step,
    basic,
    services,
    assignedEmployeeId,
    priority,
    compliance,
    checklistReview,
    setStep,
    updateBasic,
    toggleService,
    updateService,
    updateAssignment,
    updateCompliance,
    updateChecklistReview,
    reset,
  } = useClientOnboardingStore()

  useEffect(() => {
    // Show draft saved indicator when data changes
    const timer = setTimeout(() => {
      setShowDraftSaved(true)
      const hideTimer = setTimeout(() => setShowDraftSaved(false), 2000)
      return () => clearTimeout(hideTimer)
    }, 500)
    return () => clearTimeout(timer)
  }, [basic, services, assignedEmployeeId, priority, compliance, checklistReview])

  const selectedServices = useMemo(
    () =>
      Object.entries(services)
        .filter((entry): entry is [ServiceType, OnboardingServiceConfig] =>
          Boolean(entry[1]?.selected)
        )
        .map(([serviceType, config]) => ({
          serviceType,
          frequency: config.frequency,
          nextDueDate: config.nextDueDate || undefined,
        })),
    [services]
  )

  const checklist = useMemo(
    () => buildDocumentChecklist(selectedServices),
    [selectedServices]
  )

  const servicesJson = JSON.stringify(selectedServices)
  const canContinue = getStepValidity(step, {
    hasName: basic.name.trim().length >= 2,
    hasService: selectedServices.length > 0,
    hasConfiguredServices: selectedServices.every(
      (service) => services[service.serviceType]?.frequency
    ),
    hasChecklistReviewed: checklistReview.reviewed,
  })

  useEffect(() => {
    if (state.success) {
      toast.success("Client onboarding complete", {
        description:
          "Client, services, tasks, schedules, reminders, and checklist were generated.",
      })
      const timer = window.setTimeout(() => {
        reset()
        setOpen(false)
        onSuccess?.()
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (state.error) {
      toast.error(state.error)
    }

    if (state.fieldErrors && !state.success) {
      toast.error("Please correct the highlighted fields.")
    }
  }, [state, reset, onSuccess])

  function nextStep() {
    setStep(Math.min(step + 1, steps.length - 1))
  }

  function previousStep() {
    setStep(Math.max(step - 1, 0))
  }

  function handleComplete() {
    setShowConfirmDialog(true)
  }

  function handleConfirmSubmit() {
    setShowConfirmDialog(false)
    // Trigger form submission via hidden button
    const submitButton = document.querySelector('button[type="submit"][name="confirm-submit"]') as HTMLButtonElement
    if (submitButton) submitButton.click()
  }

  function handleCancelSubmit() {
    setShowConfirmDialog(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="btn-glow h-9 gap-1.5 rounded-xl px-4">
            <Plus className="size-3.5" />
            Add client
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[94vh] overflow-hidden border-white/[0.08] bg-popover/95 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:max-w-5xl">
          <div className="border-b border-white/[0.06] px-5 py-5 md:px-7">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-gradient text-xl font-semibold tracking-tight">
                    Client onboarding
                  </DialogTitle>
                  <DialogDescription className="text-[13px] leading-relaxed">
                    Build a complete client master with connected operational records.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form
            action={formAction}
            className="grid max-h-[calc(94vh-88px)] overflow-hidden lg:grid-cols-[280px_1fr]"
            onSubmit={(e) => {
              if (!canContinue || isPending) {
                e.preventDefault()
                toast.error(
                  "Complete all required steps before finishing onboarding."
                )
              }
            }}
          >
            <input type="hidden" name="services" value={servicesJson} />
            <input type="hidden" name="name" value={basic.name} />
            <input type="hidden" name="gstin" value={basic.gstin} />
            <input type="hidden" name="pan" value={basic.pan} />
            <input type="hidden" name="email" value={basic.email} />
            <input type="hidden" name="phone" value={basic.phone} />
            <input type="hidden" name="whatsapp" value={basic.whatsapp} />
            <input type="hidden" name="address" value={basic.address} />
            <input type="hidden" name="notes" value={basic.notes} />
            <input type="hidden" name="assignedEmployeeId" value={assignedEmployeeId} />
            <input type="hidden" name="priority" value={priority} />
            <input
              type="hidden"
              name="reminderDaysBefore"
              value={compliance.reminderDaysBefore}
            />
            {compliance.notifyEmail && (
              <input type="hidden" name="notificationPreferences" value="EMAIL" />
            )}
            {compliance.notifyWhatsApp && (
              <input type="hidden" name="notificationPreferences" value="WHATSAPP" />
            )}
            {compliance.notifyDashboard && (
              <input type="hidden" name="notificationPreferences" value="DASHBOARD" />
            )}

            <button type="submit" name="confirm-submit" className="hidden" />

            <aside className="border-b border-white/[0.06] bg-black/10 p-4 lg:border-b-0 lg:border-r lg:p-5">
              <div className="grid gap-2 sm:grid-cols-5 lg:grid-cols-1">
                {steps.map((item, index) => {
                  const Icon = item.icon
                  const isActive = step === index
                  const isDone = step > index

                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => setStep(index)}
                      className={cn(
                        "group flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-all duration-300",
                        isActive
                          ? "border-primary/30 bg-primary/10 text-foreground shadow-[0_10px_34px_-20px_oklch(0.72_0.14_230/70%)]"
                          : "border-white/[0.06] bg-white/[0.025] text-muted-foreground hover:border-white/[0.12] hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                          isDone
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                            : isActive
                              ? "border-primary/25 bg-primary/10 text-primary"
                              : "border-white/[0.08] bg-white/[0.03]"
                        )}
                      >
                        {isDone ? <Check className="size-4" /> : <Icon className="size-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] uppercase tracking-wide opacity-70">
                          Step {index + 1}
                        </span>
                        <span className="block text-sm font-medium leading-tight">
                          {item.title}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                />
              </div>
              <AnimatePresence>
                {showDraftSaved && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Save className="size-3" />
                    Draft saved automatically
                  </motion.div>
                )}
              </AnimatePresence>
            </aside>

            <main className="flex min-h-[560px] flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 md:p-7">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -18 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {step === 0 && (
                      <BasicInfoStep
                        basic={basic}
                        errors={state.fieldErrors}
                        updateBasic={updateBasic}
                      />
                    )}
                    {step === 1 && (
                      <ServicesStep
                        selected={services}
                        toggleService={toggleService}
                      />
                    )}
                    {step === 2 && (
                      <ConfigurationStep
                        services={services}
                        employees={employees}
                        assignedEmployeeId={assignedEmployeeId}
                        priority={priority}
                        updateService={updateService}
                        updateAssignment={updateAssignment}
                      />
                    )}
                    {step === 3 && (
                      <ChecklistStep
                        selectedServices={selectedServices}
                        checklist={checklist}
                        checklistReview={checklistReview}
                        updateChecklistReview={updateChecklistReview}
                      />
                    )}
                    {step === 4 && (
                      <ComplianceStep
                        compliance={compliance}
                        updateCompliance={updateCompliance}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {state.fieldErrors?.services && (
                <p className="border-t border-white/[0.06] px-5 py-2 text-xs text-destructive md:px-7">
                  {state.fieldErrors.services[0]}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={previousStep}
                    disabled={step === 0 || isPending}
                    className="input-premium h-10 rounded-xl"
                  >
                    <ChevronLeft className="size-4" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={reset}
                    disabled={isPending}
                    className="input-premium h-10 rounded-xl"
                  >
                    Reset
                  </Button>
                </div>

                {step < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={!canContinue || isPending}
                    className="btn-glow h-10 rounded-xl px-5"
                  >
                    Continue
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleComplete}
                    disabled={!canContinue || isPending}
                    className="btn-glow h-10 rounded-xl px-6"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Completing...
                      </>
                    ) : (
                      "Complete onboarding"
                    )}
                  </Button>
                )}
              </div>
            </main>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete client onboarding?</DialogTitle>
            <DialogDescription>
              This will create the client, generate tasks, schedules, reminders, and document checklist. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
              <p className="text-sm font-medium">Client: {basic.name}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {selectedServices.length} service(s) selected
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Assigned to: {assignedEmployeeId ? employees.find((e) => e.id === assignedEmployeeId)?.name || "Unassigned" : "Unassigned"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelSubmit} className="input-premium rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit} className="btn-glow rounded-xl">
              Confirm & Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BasicInfoStep({
  basic,
  errors,
  updateBasic,
}: {
  basic: Record<string, string>
  errors?: Record<string, string[]>
  updateBasic: (data: Partial<typeof basic>) => void
}) {
  return (
    <StepFrame
      title="Basic Information"
      description="Core identity, tax IDs, and contact details for the client master."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" required error={errors?.name?.[0]} className="sm:col-span-2">
          <Input
            value={basic.name}
            onChange={(event) => updateBasic({ name: event.target.value })}
            placeholder="Acme Holdings Pvt Ltd"
            className="input-premium h-10 rounded-xl"
          />
        </Field>
        <Field label="GSTIN" error={errors?.gstin?.[0]}>
          <Input
            value={basic.gstin}
            onChange={(event) => updateBasic({ gstin: event.target.value.toUpperCase() })}
            placeholder="27AABCU9603R1ZM"
            className="input-premium h-10 rounded-xl font-mono text-sm uppercase"
          />
        </Field>
        <Field label="PAN" error={errors?.pan?.[0]}>
          <Input
            value={basic.pan}
            onChange={(event) => updateBasic({ pan: event.target.value.toUpperCase() })}
            placeholder="AABCU9603R"
            className="input-premium h-10 rounded-xl font-mono text-sm uppercase"
          />
        </Field>
        <Field label="Email" error={errors?.email?.[0]}>
          <Input
            value={basic.email}
            onChange={(event) => updateBasic({ email: event.target.value })}
            type="email"
            placeholder="accounts@company.com"
            className="input-premium h-10 rounded-xl"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={basic.phone}
            onChange={(event) => updateBasic({ phone: event.target.value })}
            placeholder="+91 98765 43210"
            className="input-premium h-10 rounded-xl"
          />
        </Field>
        <Field label="WhatsApp">
          <Input
            value={basic.whatsapp}
            onChange={(event) => updateBasic({ whatsapp: event.target.value })}
            placeholder="+91 98765 43210"
            className="input-premium h-10 rounded-xl"
          />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea
            value={basic.address}
            onChange={(event) => updateBasic({ address: event.target.value })}
            placeholder="Registered office address"
            className="input-premium min-h-24 rounded-xl"
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            value={basic.notes}
            onChange={(event) => updateBasic({ notes: event.target.value })}
            placeholder="Internal context, billing preferences, handover notes"
            className="input-premium min-h-24 rounded-xl"
          />
        </Field>
      </div>
    </StepFrame>
  )
}

function ServicesStep({
  selected,
  toggleService,
}: {
  selected: Partial<Record<ServiceType, OnboardingServiceConfig>>
  toggleService: (serviceType: ServiceType) => void
}) {
  return (
    <StepFrame
      title="Services Selection"
      description="Choose the services that will be provisioned for this client."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {serviceOptions.map((serviceType) => {
          const isSelected = Boolean(selected[serviceType]?.selected)
          return (
            <button
              key={serviceType}
              type="button"
              onClick={() => toggleService(serviceType)}
              className={cn(
                "surface-elevated min-h-28 rounded-xl p-4 text-left transition-all duration-300",
                isSelected && "border-primary/30 bg-primary/10 ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{SERVICE_TYPE_LABELS[serviceType]}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {getServiceDescription(serviceType)}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    isSelected
                      ? "border-primary/30 bg-primary text-primary-foreground"
                      : "border-white/[0.12] bg-white/[0.03]"
                  )}
                >
                  {isSelected && <Check className="size-3.5" />}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </StepFrame>
  )
}

function ConfigurationStep({
  services,
  employees,
  assignedEmployeeId,
  priority,
  updateService,
  updateAssignment,
}: {
  services: Partial<Record<ServiceType, OnboardingServiceConfig>>
  employees: EmployeeOption[]
  assignedEmployeeId: string
  priority: ClientPriority
  updateService: (
    serviceType: ServiceType,
    data: Partial<OnboardingServiceConfig>
  ) => void
  updateAssignment: (data: {
    assignedEmployeeId?: string
    priority?: ClientPriority
  }) => void
}) {
  const selected = serviceOptions.filter(
    (serviceType) => services[serviceType]?.selected
  )

  return (
    <StepFrame
      title="Service Configuration"
      description="Set cycles, first due dates, team ownership, and priority."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Assigned employee">
          <select
            value={assignedEmployeeId}
            onChange={(event) =>
              updateAssignment({ assignedEmployeeId: event.target.value })
            }
            className="input-premium h-10 w-full rounded-xl px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
                {employee.department ? ` - ${employee.department}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={priority}
            onChange={(event) =>
              updateAssignment({ priority: event.target.value as ClientPriority })
            }
            className="input-premium h-10 w-full rounded-xl px-3 text-sm"
          >
            {ALL_CLIENT_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {CLIENT_PRIORITY_LABELS[item]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Separator className="my-6 bg-white/[0.06]" />

      <div className="space-y-3">
        {selected.map((serviceType) => {
          const config = services[serviceType]
          return (
            <div
              key={serviceType}
              className="surface-elevated grid gap-4 rounded-xl p-4 md:grid-cols-[1fr_160px_180px]"
            >
              <div>
                <p className="font-medium">{SERVICE_TYPE_LABELS[serviceType]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Initial tasks and schedules will be generated automatically.
                </p>
              </div>
              <Field label="Frequency">
                <select
                  value={config?.frequency ?? "MONTHLY"}
                  onChange={(event) =>
                    updateService(serviceType, {
                      frequency: event.target.value as ServiceFrequency,
                    })
                  }
                  className="input-premium h-10 w-full rounded-xl px-3 text-sm"
                >
                  {Object.entries(SERVICE_FREQUENCY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="First due date">
                <Input
                  type="date"
                  value={config?.nextDueDate ?? ""}
                  onChange={(event) =>
                    updateService(serviceType, {
                      nextDueDate: event.target.value,
                    })
                  }
                  className="input-premium h-10 rounded-xl"
                />
              </Field>
            </div>
          )
        })}
      </div>
    </StepFrame>
  )
}

function ChecklistStep({
  selectedServices,
  checklist,
  checklistReview,
  updateChecklistReview,
}: {
  selectedServices: { serviceType: ServiceType }[]
  checklist: string[]
  checklistReview: { reviewed: boolean }
  updateChecklistReview: (data: Partial<{ reviewed: boolean }>) => void
}) {
  return (
    <StepFrame
      title="Document Checklist"
      description="Checklist records are generated from the selected service mix."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {selectedServices.map((service) => (
          <Badge
            key={service.serviceType}
            variant="outline"
            className="border-primary/25 bg-primary/10 text-primary"
          >
            {SERVICE_TYPE_LABELS[service.serviceType]}
          </Badge>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {checklist.map((item) => (
          <div key={item} className="surface-elevated flex items-start gap-3 rounded-xl p-4">
            <FileCheck2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            <span className="text-sm">{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 surface-elevated flex items-center gap-3 rounded-xl p-4">
        <input
          type="checkbox"
          id="checklist-review"
          checked={checklistReview.reviewed}
          onChange={(e) => updateChecklistReview({ reviewed: e.target.checked })}
          className="size-4 rounded border-white/20 accent-primary"
        />
        <label htmlFor="checklist-review" className="text-sm font-medium cursor-pointer">
          I have reviewed the document checklist and confirm all required documents will be collected
        </label>
      </div>
    </StepFrame>
  )
}

function ComplianceStep({
  compliance,
  updateCompliance,
}: {
  compliance: {
    reminderDaysBefore: string
    notifyEmail: boolean
    notifyWhatsApp: boolean
    notifyDashboard: boolean
  }
  updateCompliance: (data: Partial<typeof compliance>) => void
}) {
  return (
    <StepFrame
      title="Compliance Setup"
      description="Configure reminder timing and notification channels."
    >
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <Field label="Reminder lead time">
          <Input
            type="number"
            min={1}
            max={60}
            value={compliance.reminderDaysBefore}
            onChange={(event) =>
              updateCompliance({ reminderDaysBefore: event.target.value })
            }
            className="input-premium h-10 rounded-xl"
          />
        </Field>
        <div className="surface-elevated rounded-xl p-4">
          <p className="text-sm font-medium">Notification preferences</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ToggleCard
              label="Email"
              checked={compliance.notifyEmail}
              onChange={(checked) => updateCompliance({ notifyEmail: checked })}
            />
            <ToggleCard
              label="WhatsApp"
              checked={compliance.notifyWhatsApp}
              onChange={(checked) => updateCompliance({ notifyWhatsApp: checked })}
            />
            <ToggleCard
              label="Dashboard"
              checked={compliance.notifyDashboard}
              onChange={(checked) => updateCompliance({ notifyDashboard: checked })}
            />
          </div>
        </div>
      </div>
    </StepFrame>
  )
}

function StepFrame({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-6">
        <p className="label-premium">{title}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-[13px]">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all duration-300",
        checked
          ? "border-primary/30 bg-primary/10"
          : "border-white/[0.08] bg-white/[0.025]"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-white/20 accent-primary"
      />
    </label>
  )
}

function getServiceDescription(serviceType: ServiceType) {
  switch (serviceType) {
    case "GST_RETURN":
      return "Returns, reconciliations, and input credit review."
    case "TDS":
      return "Deduction tracking, challans, and quarterly returns."
    case "COMPANY_LAW":
      return "ROC filings, annual returns, and statutory records."
    case "BOOKKEEPING":
      return "Monthly books, ledgers, and reporting hygiene."
    case "AUDIT":
      return "Audit preparation, evidence, and review workflow."
    case "INCOME_TAX":
      return "Return preparation, AIS review, and tax computation."
    case "OTHER":
      return "Custom advisory or firm-specific engagement scope."
    default:
      return "Recurring service workflow."
  }
}

function getStepValidity(
  step: number,
  checks: {
    hasName: boolean
    hasService: boolean
    hasConfiguredServices: boolean
    hasChecklistReviewed: boolean
  }
) {
  if (step === 0) return checks.hasName
  if (step === 1) return checks.hasService
  if (step === 2) return checks.hasConfiguredServices
  if (step === 3) return checks.hasChecklistReviewed
  return true
}
