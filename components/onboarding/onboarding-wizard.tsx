"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Users,
  Briefcase,
  UserPlus,
  Mail,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Bell,
  FileText,
  ExternalLink,
  SkipForward,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getOnboardingStatus,
  saveFirmInformation,
  saveServiceConfiguration,
  saveEmailConfiguration,
  completeOnboarding,
  skipOnboarding,
  createEmployeeFromOnboarding,
  createClientFromOnboarding,
} from "@/app/actions/onboarding"
import { cn } from "@/lib/utils"

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    title: "Firm Information",
    subtitle: "Tell us about your practice",
    icon: Building2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    id: 2,
    title: "Add Employees",
    subtitle: "Build your team",
    icon: Users,
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    id: 3,
    title: "Add Services",
    subtitle: "Configure your offerings",
    icon: Briefcase,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    id: 4,
    title: "Add First Client",
    subtitle: "Onboard your first client",
    icon: UserPlus,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    id: 5,
    title: "Configure Email",
    subtitle: "Set up notifications",
    icon: Mail,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    id: 6,
    title: "Ready to Launch",
    subtitle: "You're all set!",
    icon: Rocket,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
]

const TOTAL_STEPS = 6

// ─── Types ────────────────────────────────────────────────────────────────────

type EmployeeRow = {
  id: string
  name: string
  email: string
  department: string
  status: "pending" | "saving" | "saved" | "error"
  error?: string
}

// ─── Root wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Firm info — captured into FirmSettings on save so outbound email immediately
  // uses the firm's identity.
  const [firmInfo, setFirmInfo] = useState({
    firmName: "",
    gstin: "",
    address: "",
    phone: "",
    email: "",
    replyToEmail: "",
    website: "",
  })
  const [firmError, setFirmError] = useState("")

  // Employees
  const [employees, setEmployees] = useState<EmployeeRow[]>([
    { id: "1", name: "", email: "", department: "", status: "pending" },
  ])
  const [employeesCreated, setEmployeesCreated] = useState(false)

  // Services
  const [serviceConfig, setServiceConfig] = useState({
    services: [] as string[],
    defaultReminderDays: 7,
  })

  // Client
  const [clientInfo, setClientInfo] = useState({
    name: "",
    email: "",
    phone: "",
    gstin: "",
  })
  const [clientCreated, setClientCreated] = useState<{ id: string; name: string } | null>(null)
  const [clientError, setClientError] = useState("")

  // Email config
  const [emailConfig, setEmailConfig] = useState({
    emailEnabled: true,
    whatsappEnabled: false,
    reminderFrequency: "daily",
  })

  const checkOnboardingStatus = useCallback(async () => {
    try {
      const status = await getOnboardingStatus()
      if (status.completed) {
        router.push("/")
      } else {
        // Resume from last step, but cap at TOTAL_STEPS
        const resumeStep = Math.min(Math.max(status.step || 1, 1), TOTAL_STEPS)
        setCurrentStep(resumeStep)
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    checkOnboardingStatus()
  }, [checkOnboardingStatus])

  // ─── Navigation ─────────────────────────────────────────────────────────────

  const handleBack = () => setCurrentStep((p) => Math.max(1, p - 1))

  const handleSkipAll = async () => {
    try {
      setSaving(true)
      await skipOnboarding()
      router.push("/")
    } catch (error) {
      console.error("Skip failed:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleNext = async () => {
    setSaving(true)
    try {
      switch (currentStep) {
        case 1: {
          if (!firmInfo.firmName.trim()) {
            setFirmError("Firm name is required to continue.")
            setSaving(false)
            return
          }
          setFirmError("")
          await saveFirmInformation(firmInfo)
          break
        }

        case 2: {
          // Create any pending employees that have name + email filled
          const toCreate = employees.filter(
            (e) => e.name.trim() && e.email.trim() && e.status === "pending"
          )
          if (toCreate.length > 0) {
            const updated = [...employees]
            for (const emp of toCreate) {
              const idx = updated.findIndex((e) => e.id === emp.id)
              updated[idx] = { ...updated[idx], status: "saving" }
            }
            setEmployees([...updated])

            for (const emp of toCreate) {
              const result = await createEmployeeFromOnboarding({
                name: emp.name,
                email: emp.email,
                department: emp.department || undefined,
              })
              const idx = updated.findIndex((e) => e.id === emp.id)
              if (result.success) {
                updated[idx] = { ...updated[idx], status: "saved" }
              } else {
                updated[idx] = { ...updated[idx], status: "error", error: result.error }
              }
            }
            setEmployees([...updated])
          }
          setEmployeesCreated(true)
          break
        }

        case 3: {
          await saveServiceConfiguration(serviceConfig)
          break
        }

        case 4: {
          // If client form has a name, create the client
          if (clientInfo.name.trim() && !clientCreated) {
            const result = await createClientFromOnboarding({
              name: clientInfo.name,
              email: clientInfo.email || undefined,
              phone: clientInfo.phone || undefined,
              gstin: clientInfo.gstin || undefined,
            })
            if (!result.success) {
              setClientError(result.error ?? "Failed to create client.")
              setSaving(false)
              return
            }
            setClientError("")
            setClientCreated({ id: result.clientId!, name: result.clientName! })
          }
          break
        }

        case 5: {
          await saveEmailConfiguration(emailConfig)
          break
        }

        case 6: {
          await completeOnboarding()
          router.push("/")
          return
        }
      }

      setCurrentStep((p) => p + 1)
    } catch (error) {
      console.error("Step save failed:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleSkipStep = async () => {
    // Skip current optional step
    setSaving(true)
    try {
      setCurrentStep((p) => p + 1)
    } finally {
      setSaving(false)
    }
  }

  // ─── Employee helpers ────────────────────────────────────────────────────────

  const addEmployeeRow = () => {
    setEmployees((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", email: "", department: "", status: "pending" },
    ])
  }

  const removeEmployeeRow = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  const updateEmployee = (id: string, field: keyof EmployeeRow, value: string) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value, status: "pending", error: undefined } : e))
    )
  }

  const toggleService = (serviceId: string) => {
    setServiceConfig((prev) => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter((s) => s !== serviceId)
        : [...prev.services, serviceId],
    }))
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading setup wizard…</span>
        </div>
      </div>
    )
  }

  const progressPct = Math.round(((currentStep - 1) / TOTAL_STEPS) * 100)
  const isOptionalStep = currentStep === 2 || currentStep === 4

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">J-TACS Setup</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">
            Step {currentStep} of {TOTAL_STEPS}
          </span>
          {currentStep < TOTAL_STEPS && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkipAll}
              disabled={saving}
              className="text-muted-foreground hover:text-foreground text-xs gap-1"
            >
              Skip all
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted shrink-0">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — hidden on small screens */}
        <div className="hidden lg:flex w-64 xl:w-72 border-r border-white/[0.08] flex-col p-6 shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-5">
            Setup Steps
          </p>
          <nav className="space-y-1">
            {STEPS.map((step) => {
              const done = step.id < currentStep
              const active = step.id === currentStep
              const Icon = step.icon

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    active && "bg-primary/10",
                    !active && !done && "opacity-40"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0",
                      done
                        ? "border-green-500 bg-green-500 text-white"
                        : active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 bg-transparent"
                    )}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium leading-tight", active && "text-foreground")}>
                      {step.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{step.subtitle}</p>
                  </div>
                </div>
              )
            })}
          </nav>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto flex items-start justify-center p-6 lg:p-10">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <StepFirmInformation
                  key="firm"
                  data={firmInfo}
                  onChange={setFirmInfo}
                  error={firmError}
                  saving={saving}
                  onNext={handleNext}
                />
              )}
              {currentStep === 2 && (
                <StepAddEmployees
                  key="employees"
                  employees={employees}
                  created={employeesCreated}
                  saving={saving}
                  onAdd={addEmployeeRow}
                  onRemove={removeEmployeeRow}
                  onUpdate={updateEmployee}
                  onNext={handleNext}
                  onBack={handleBack}
                  onSkip={handleSkipStep}
                />
              )}
              {currentStep === 3 && (
                <StepAddServices
                  key="services"
                  data={serviceConfig}
                  onChange={setServiceConfig}
                  onToggle={toggleService}
                  saving={saving}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {currentStep === 4 && (
                <StepAddFirstClient
                  key="client"
                  data={clientInfo}
                  onChange={setClientInfo}
                  created={clientCreated}
                  error={clientError}
                  saving={saving}
                  onNext={handleNext}
                  onBack={handleBack}
                  onSkip={handleSkipStep}
                />
              )}
              {currentStep === 5 && (
                <StepConfigureEmail
                  key="email"
                  data={emailConfig}
                  onChange={setEmailConfig}
                  saving={saving}
                  onNext={handleNext}
                  onBack={handleBack}
                  onSkip={isOptionalStep ? handleSkipStep : undefined}
                />
              )}
              {currentStep === 6 && (
                <StepReadyToLaunch
                  key="launch"
                  firmName={firmInfo.firmName}
                  employeeCount={employees.filter((e) => e.status === "saved").length}
                  serviceCount={serviceConfig.services.length}
                  clientCreated={clientCreated}
                  saving={saving}
                  onLaunch={handleNext}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step components ──────────────────────────────────────────────────────────

const stepVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
}

function StepHeader({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 mb-8">
      <div className={cn("p-3 rounded-xl shrink-0", iconBg)}>
        <Icon className={cn("h-6 w-6", iconColor)} />
      </div>
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  )
}

function StepNav({
  onBack,
  onNext,
  onSkip,
  saving,
  nextLabel = "Continue",
  backDisabled,
}: {
  onBack?: () => void
  onNext: () => void
  onSkip?: () => void
  saving?: boolean
  nextLabel?: string
  backDisabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} disabled={saving || backDisabled} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        {onSkip && (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={saving}
            className="text-muted-foreground text-sm gap-1"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip for now
          </Button>
        )}
      </div>
      <Button onClick={onNext} disabled={saving} className="gap-2 min-w-32">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  )
}

// ─── Step 1: Firm Information ─────────────────────────────────────────────────

function StepFirmInformation({
  data,
  onChange,
  error,
  saving,
  onNext,
}: {
  data: any
  onChange: (d: any) => void
  error: string
  saving: boolean
  onNext: () => void
}) {
  return (
    <motion.div variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
      <StepHeader
        icon={Building2}
        iconBg="bg-blue-500/10"
        iconColor="text-blue-400"
        title="Tell us about your firm"
        description="This information appears on your invoices, emails, and client communications."
      />

      <Card className="bg-white/[0.02] border-white/[0.08] p-6">
        <div className="space-y-5">
          <div>
            <Label htmlFor="firmName">
              Firm Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firmName"
              value={data.firmName}
              onChange={(e) => onChange({ ...data, firmName: e.target.value })}
              placeholder="e.g. Sharma & Associates CA"
              className="mt-2"
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              value={data.gstin}
              onChange={(e) => onChange({ ...data, gstin: e.target.value })}
              placeholder="22AAAAA0000A1Z5 (optional)"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={data.address}
              onChange={(e) => onChange({ ...data, address: e.target.value })}
              placeholder="Office address (optional)"
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={data.phone}
                onChange={(e) => onChange({ ...data, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="firmEmail">
                Firm Email <span className="text-muted-foreground text-xs">(used as sender)</span>
              </Label>
              <Input
                id="firmEmail"
                type="email"
                value={data.email}
                onChange={(e) => onChange({ ...data, email: e.target.value })}
                placeholder="office@yourfirm.com"
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="replyToEmail">
                Reply-To Email <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="replyToEmail"
                type="email"
                value={data.replyToEmail}
                onChange={(e) => onChange({ ...data, replyToEmail: e.target.value })}
                placeholder="contact@yourfirm.com"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="firmWebsite">
                Website <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="firmWebsite"
                type="url"
                value={data.website}
                onChange={(e) => onChange({ ...data, website: e.target.value })}
                placeholder="https://yourfirm.com"
                className="mt-2"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
        <span>Your firm name and email become the <strong>sender identity</strong> for every client email. You can verify your domain after onboarding from <strong>Settings → Email Domain Verification</strong>.</span>
      </div>

      <StepNav onNext={onNext} saving={saving} nextLabel="Save & Continue" />
    </motion.div>
  )
}

// ─── Step 2: Add Employees ────────────────────────────────────────────────────

function StepAddEmployees({
  employees,
  created,
  saving,
  onAdd,
  onRemove,
  onUpdate,
  onNext,
  onBack,
  onSkip,
}: {
  employees: EmployeeRow[]
  created: boolean
  saving: boolean
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: keyof EmployeeRow, value: string) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const savedCount = employees.filter((e) => e.status === "saved").length
  const hasFilledRows = employees.some((e) => e.name.trim() && e.email.trim())

  const DEPARTMENTS = ["Taxation", "Audit", "Accounting", "Legal", "Payroll", "IT", "Admin"]

  return (
    <motion.div variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
      <StepHeader
        icon={Users}
        iconBg="bg-green-500/10"
        iconColor="text-green-400"
        title="Add your team members"
        description="Add the employees who will use J-TACS to manage clients and filings."
      />

      <Card className="bg-white/[0.02] border-white/[0.08] p-6">
        <div className="space-y-4">
          {employees.map((emp, idx) => (
            <div key={emp.id} className="space-y-3">
              {idx > 0 && <div className="border-t border-white/[0.06]" />}

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Employee {idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  {emp.status === "saved" && (
                    <Badge variant="outline" className="text-green-400 border-green-500/30 text-xs py-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Added
                    </Badge>
                  )}
                  {emp.status === "error" && (
                    <span className="text-xs text-destructive">{emp.error}</span>
                  )}
                  {emp.status === "saving" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {employees.length > 1 && emp.status !== "saved" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemove(emp.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "grid gap-3",
                  emp.status === "saved" && "opacity-60 pointer-events-none"
                )}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`emp-name-${emp.id}`} className="text-xs">
                      Full Name
                    </Label>
                    <Input
                      id={`emp-name-${emp.id}`}
                      value={emp.name}
                      onChange={(e) => onUpdate(emp.id, "name", e.target.value)}
                      placeholder="Rajesh Kumar"
                      className="mt-1.5 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`emp-email-${emp.id}`} className="text-xs">
                      Work Email
                    </Label>
                    <Input
                      id={`emp-email-${emp.id}`}
                      type="email"
                      value={emp.email}
                      onChange={(e) => onUpdate(emp.id, "email", e.target.value)}
                      placeholder="rajesh@yourfirm.com"
                      className="mt-1.5 h-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`emp-dept-${emp.id}`} className="text-xs">
                    Department <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Select
                    value={emp.department}
                    onValueChange={(v) => onUpdate(emp.id, "department", v)}
                  >
                    <SelectTrigger id={`emp-dept-${emp.id}`} className="mt-1.5 h-9 text-sm">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            disabled={saving}
            className="w-full gap-2 text-muted-foreground hover:text-foreground mt-2"
          >
            <Plus className="h-4 w-4" />
            Add another employee
          </Button>
        </div>
      </Card>

      {savedCount > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {savedCount} employee{savedCount !== 1 ? "s" : ""} added successfully.
            {!created && " Click Continue to proceed."}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
        <Users className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
        <span>
          Employees will receive a login invitation when you create their user account from the{" "}
          <strong>Employees</strong> section. You can add more team members at any time.
        </span>
      </div>

      {!hasFilledRows && (
        <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-400/60" />
          <span>This step is optional — you can skip if you want to add employees later.</span>
        </div>
      )}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        saving={saving}
        nextLabel={hasFilledRows ? "Add & Continue" : "Continue"}
      />
    </motion.div>
  )
}

// ─── Step 3: Add Services ─────────────────────────────────────────────────────

const SERVICE_OPTIONS = [
  { id: "gst", label: "GST Returns", description: "GSTR-1, GSTR-3B, Annual return" },
  { id: "income-tax", label: "Income Tax", description: "ITR filing for individuals & firms" },
  { id: "tds", label: "TDS / TCS", description: "TDS returns, Form 16, 27Q" },
  { id: "roc", label: "ROC Filings", description: "Company law, MCA compliance" },
  { id: "audit", label: "Audit Services", description: "Statutory, internal, tax audit" },
  { id: "bookkeeping", label: "Bookkeeping", description: "Monthly books, P&L, balance sheet" },
  { id: "payroll", label: "Payroll", description: "Salary processing, PF/ESI" },
  { id: "advisory", label: "Advisory", description: "Tax planning, financial advisory" },
]

function StepAddServices({
  data,
  onChange,
  onToggle,
  saving,
  onNext,
  onBack,
}: {
  data: any
  onChange: (d: any) => void
  onToggle: (id: string) => void
  saving: boolean
  onNext: () => void
  onBack: () => void
}) {
  return (
    <motion.div variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
      <StepHeader
        icon={Briefcase}
        iconBg="bg-purple-500/10"
        iconColor="text-purple-400"
        title="Select the services you offer"
        description="These services will appear when adding clients so you can track compliance requirements."
      />

      <Card className="bg-white/[0.02] border-white/[0.08] p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {SERVICE_OPTIONS.map((service) => {
            const selected = data.services.includes(service.id)
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => onToggle(service.id)}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.02]"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 rounded border items-center justify-center transition-colors",
                    selected ? "bg-primary border-primary" : "border-muted-foreground/40"
                  )}
                >
                  {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium leading-tight">{service.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-white/[0.06] pt-5">
          <Label htmlFor="reminderDays" className="text-sm">
            Default reminder — how many days before a deadline?
          </Label>
          <div className="flex items-center gap-3 mt-3">
            <Select
              value={String(data.defaultReminderDays)}
              onValueChange={(v) => onChange({ ...data, defaultReminderDays: parseInt(v) })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10, 14, 21, 30].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} days before
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              Clients will get reminders {data.defaultReminderDays} days before each deadline.
            </span>
          </div>
        </div>
      </Card>

      {data.services.length === 0 && (
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-400" />
          <span>Select at least one service to enable compliance tracking for clients.</span>
        </div>
      )}

      {data.services.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-4 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{data.services.length} service{data.services.length !== 1 ? "s" : ""} selected</span>
        </div>
      )}

      <StepNav onBack={onBack} onNext={onNext} saving={saving} nextLabel="Save & Continue" />
    </motion.div>
  )
}

// ─── Step 4: Add First Client ─────────────────────────────────────────────────

function StepAddFirstClient({
  data,
  onChange,
  created,
  error,
  saving,
  onNext,
  onBack,
  onSkip,
}: {
  data: any
  onChange: (d: any) => void
  created: { id: string; name: string } | null
  error: string
  saving: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  return (
    <motion.div variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
      <StepHeader
        icon={UserPlus}
        iconBg="bg-yellow-500/10"
        iconColor="text-yellow-400"
        title="Add your first client"
        description="Get started by adding one client — you can add many more once you're up and running."
      />

      {created ? (
        <Card className="bg-green-500/5 border-green-500/20 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-400">Client Added!</h3>
          <p className="text-muted-foreground mt-2">
            <strong>{created.name}</strong> has been added to your client portfolio.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
            You can fill in their full details, assign services, and add compliance schedules from the{" "}
            <strong>Clients</strong> section.
          </p>
        </Card>
      ) : (
        <Card className="bg-white/[0.02] border-white/[0.08] p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="clientName">
                Client Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clientName"
                value={data.name}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="e.g. Patel Enterprises Pvt Ltd"
                className="mt-2"
                autoFocus
              />
              {error && (
                <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={data.email}
                  onChange={(e) => onChange({ ...data, email: e.target.value })}
                  placeholder="client@example.com"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="clientPhone">Phone</Label>
                <Input
                  id="clientPhone"
                  value={data.phone}
                  onChange={(e) => onChange({ ...data, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="clientGstin">GSTIN</Label>
              <Input
                id="clientGstin"
                value={data.gstin}
                onChange={(e) => onChange({ ...data, gstin: e.target.value })}
                placeholder="22AAAAA0000A1Z5 (optional)"
                className="mt-2"
              />
            </div>
          </div>
        </Card>
      )}

      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
        <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
        <span>
          Once added, you can assign services, set up compliance calendars, and create invoices for this
          client from the <strong>Client 360</strong> view.
        </span>
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        onSkip={!created ? onSkip : undefined}
        saving={saving}
        nextLabel={created ? "Continue" : data.name.trim() ? "Add & Continue" : "Continue"}
      />
    </motion.div>
  )
}

// ─── Step 5: Configure Email ──────────────────────────────────────────────────

function StepConfigureEmail({
  data,
  onChange,
  saving,
  onNext,
  onBack,
  onSkip,
}: {
  data: any
  onChange: (d: any) => void
  saving: boolean
  onNext: () => void
  onBack: () => void
  onSkip?: () => void
}) {
  return (
    <motion.div variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
      <StepHeader
        icon={Mail}
        iconBg="bg-orange-500/10"
        iconColor="text-orange-400"
        title="Configure email & notifications"
        description="Choose how you want to receive compliance reminders and client alerts."
      />

      <Card className="bg-white/[0.02] border-white/[0.08] p-6 space-y-4">
        {/* Email toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...data, emailEnabled: !data.emailEnabled })}
          className={cn(
            "flex items-center justify-between w-full p-4 rounded-lg border transition-colors",
            data.emailEnabled
              ? "border-primary/40 bg-primary/5"
              : "border-white/[0.08] hover:border-white/[0.16]"
          )}
        >
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-xs text-muted-foreground">Compliance reminders, task alerts, invoices</p>
            </div>
          </div>
          <div
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              data.emailEnabled ? "bg-primary" : "bg-muted-foreground/30"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                data.emailEnabled ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </div>
        </button>

        {/* WhatsApp toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...data, whatsappEnabled: !data.whatsappEnabled })}
          className={cn(
            "flex items-center justify-between w-full p-4 rounded-lg border transition-colors",
            data.whatsappEnabled
              ? "border-green-500/40 bg-green-500/5"
              : "border-white/[0.08] hover:border-white/[0.16]"
          )}
        >
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="text-sm font-medium">WhatsApp Notifications</p>
              <p className="text-xs text-muted-foreground">
                Requires WhatsApp Business API configuration
              </p>
            </div>
          </div>
          <div
            className={cn(
              "w-10 h-5 rounded-full transition-colors relative",
              data.whatsappEnabled ? "bg-green-500" : "bg-muted-foreground/30"
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                data.whatsappEnabled ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </div>
        </button>

        {/* Reminder frequency */}
        <div className="pt-2">
          <Label className="text-sm">Reminder Frequency</Label>
          <Select
            value={data.reminderFrequency}
            onValueChange={(v) => onChange({ ...data, reminderFrequency: v })}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily digest</SelectItem>
              <SelectItem value="weekly">Weekly summary</SelectItem>
              <SelectItem value="monthly">Monthly report only</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">
            How often you receive consolidated deadline reminders.
          </p>
        </div>
      </Card>

      <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3 space-y-2">
        <p className="text-sm font-medium text-blue-400 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Firm-Branded Email — How It Works
        </p>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
          <li>Every email is sent from your firm&apos;s identity (name + address) you entered in Step 1.</li>
          <li>Until you verify your domain, emails go out with your <strong>firm display name</strong> via the platform domain. Reply-To still routes back to you.</li>
          <li>To send directly from your own domain, finish onboarding then visit{" "}
            <strong>Settings → Email Domain Verification</strong> and publish 3 DNS records.</li>
        </ul>
        <a
          href="/docs/email-setup"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
        >
          Email Setup Guide
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <StepNav onBack={onBack} onNext={onNext} onSkip={onSkip} saving={saving} nextLabel="Save & Continue" />
    </motion.div>
  )
}

// ─── Step 6: Ready to Launch ──────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: "View Dashboard", href: "/", icon: Sparkles, description: "Your firm at a glance" },
  { label: "Manage Clients", href: "/clients", icon: UserPlus, description: "Add and manage clients" },
  { label: "Work Tracker", href: "/work-tracker", icon: Briefcase, description: "Track filings & tasks" },
  { label: "Compliance", href: "/compliance", icon: FileText, description: "Upcoming deadlines" },
]

function StepReadyToLaunch({
  firmName,
  employeeCount,
  serviceCount,
  clientCreated,
  saving,
  onLaunch,
}: {
  firmName: string
  employeeCount: number
  serviceCount: number
  clientCreated: { id: string; name: string } | null
  saving: boolean
  onLaunch: () => void
}) {
  return (
    <motion.div variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
      {/* Hero */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center"
        >
          <Rocket className="h-10 w-10 text-emerald-400" />
        </motion.div>
        <h2 className="text-3xl font-semibold">You&apos;re ready to launch!</h2>
        <p className="text-muted-foreground mt-2">
          {firmName ? `${firmName} is` : "Your firm is"} set up and ready to go.
        </p>
      </div>

      {/* Summary */}
      <Card className="bg-white/[0.02] border-white/[0.08] p-6 mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide text-xs">
          Setup Summary
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/20">
            <p className="text-2xl font-bold text-green-400">{employeeCount || "–"}</p>
            <p className="text-xs text-muted-foreground mt-1">Employee{employeeCount !== 1 ? "s" : ""} added</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/20">
            <p className="text-2xl font-bold text-purple-400">{serviceCount || "–"}</p>
            <p className="text-xs text-muted-foreground mt-1">Service{serviceCount !== 1 ? "s" : ""} configured</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/20">
            <p className="text-2xl font-bold text-yellow-400">{clientCreated ? "1" : "–"}</p>
            <p className="text-xs text-muted-foreground mt-1">Client added</p>
          </div>
        </div>
        {clientCreated && (
          <div className="mt-4 flex items-center gap-2 text-sm bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="text-muted-foreground">
              First client: <strong className="text-foreground">{clientCreated.name}</strong>
            </span>
          </div>
        )}
      </Card>

      {/* Quick links */}
      <p className="text-sm text-muted-foreground mb-3">Where would you like to start?</p>
      <div className="grid grid-cols-2 gap-3 mb-8">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon
          return (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 p-4 rounded-lg border border-white/[0.08] hover:border-primary/30 hover:bg-primary/5 transition-colors group"
            >
              <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              <div>
                <p className="text-sm font-medium leading-tight">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          )
        })}
      </div>

      {/* Launch button */}
      <Button
        size="lg"
        onClick={onLaunch}
        disabled={saving}
        className="w-full gap-3 h-12 text-base"
      >
        {saving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Launching…
          </>
        ) : (
          <>
            <Rocket className="h-5 w-5" />
            Go to Dashboard
          </>
        )}
      </Button>
    </motion.div>
  )
}
