"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Users,
  Briefcase,
  Upload,
  Bell,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Sparkles,
  Settings,
  FileText,
  Clock,
  Mail,
  MessageSquare,
  ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  saveEmployeeSetup,
  saveServiceConfiguration,
  saveClientImport,
  saveNotificationPreferences,
  skipOnboarding,
} from "@/app/actions/onboarding"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 0, title: "Welcome", icon: Sparkles },
  { id: 1, title: "Firm Information", icon: Building2 },
  { id: 2, title: "Employee Setup", icon: Users },
  { id: 3, title: "Service Configuration", icon: Briefcase },
  { id: 4, title: "Client Import", icon: Upload },
  { id: 5, title: "Notification Preferences", icon: Bell },
]

export function OnboardingWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [skipping, setSkipping] = useState(false)

  // Form states
  const [firmInfo, setFirmInfo] = useState({
    firmName: "",
    gstin: "",
    address: "",
    phone: "",
    email: "",
  })
  const [employeeSetup, setEmployeeSetup] = useState({
    employeeCount: "",
    departments: [] as string[],
  })
  const [serviceConfig, setServiceConfig] = useState({
    services: [] as string[],
    defaultReminderDays: 7,
  })
  const [clientImport, setClientImport] = useState({
    importMethod: "manual" as "manual" | "csv",
    clientCount: "",
  })
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: true,
    reminderFrequency: "daily",
  })

  const checkOnboardingStatus = useCallback(async () => {
    try {
      const status = await getOnboardingStatus()
      if (status.completed) {
        router.push("/")
      } else {
        setCurrentStep(status.step)
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

  const handleNext = async () => {
    if (currentStep === 0) {
      setCurrentStep(1)
      return
    }

    try {
      switch (currentStep) {
        case 1:
          await saveFirmInformation(firmInfo)
          break
        case 2:
          await saveEmployeeSetup({
            employeeCount: parseInt(String(employeeSetup.employeeCount), 10) || 0,
            departments: employeeSetup.departments,
          })
          break
        case 3:
          await saveServiceConfiguration(serviceConfig)
          break
        case 4:
          await saveClientImport({
            importMethod: clientImport.importMethod,
            clientCount: parseInt(String(clientImport.clientCount), 10) || undefined,
          })
          break
        case 5:
          await saveNotificationPreferences(notificationPrefs)
          router.push("/")
          return
      }
      setCurrentStep((prev) => prev + 1)
    } catch (error) {
      console.error("Failed to save step:", error)
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1))
  }

  const handleSkip = async () => {
    try {
      setSkipping(true)
      await skipOnboarding()
      router.push("/")
    } catch (error) {
      console.error("Failed to skip onboarding:", error)
    } finally {
      setSkipping(false)
    }
  }

  const toggleDepartment = (dept: string) => {
    setEmployeeSetup((prev) => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept],
    }))
  }

  const toggleService = (service: string) => {
    setServiceConfig((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }))
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background z-50 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Setup Wizard</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={skipping}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip
              <X className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex-1">
                <div className="flex items-center gap-2">
                  <motion.div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                      index <= currentStep
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background"
                    )}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                  >
                    {index < currentStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </motion.div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-0.5 transition-colors",
                        index < currentStep ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <WelcomeStep key="welcome" onNext={handleNext} />
          )}
          {currentStep === 1 && (
            <FirmInformationStep
              key="firm"
              data={firmInfo}
              onChange={setFirmInfo}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 2 && (
            <EmployeeSetupStep
              key="employee"
              data={employeeSetup}
              onChange={setEmployeeSetup}
              onToggleDepartment={toggleDepartment}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 3 && (
            <ServiceConfigurationStep
              key="service"
              data={serviceConfig}
              onChange={setServiceConfig}
              onToggleService={toggleService}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 4 && (
            <ClientImportStep
              key="client"
              data={clientImport}
              onChange={setClientImport}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep === 5 && (
            <NotificationPreferencesStep
              key="notification"
              data={notificationPrefs}
              onChange={setNotificationPrefs}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white/[0.02] border-white/[0.08] p-12 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
        >
          <Sparkles className="h-10 w-10 text-primary" />
        </motion.div>
        <h1 className="text-3xl font-semibold mb-4">Welcome to J-TAX</h1>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Let us set up your account in just a few steps. We will guide you through configuring your firm, employees, services, and preferences.
        </p>
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>Firm Setup</span>
          </div>
          <div className="w-px h-4 bg-muted-foreground/30" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Team</span>
          </div>
          <div className="w-px h-4 bg-muted-foreground/30" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            <span>Services</span>
          </div>
        </div>
        <Button size="lg" onClick={onNext} className="rounded-xl">
          Get Started
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Card>
    </motion.div>
  )
}

function FirmInformationStep({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: any
  onChange: (data: any) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white/[0.02] border-white/[0.08] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Firm Information</h2>
            <p className="text-sm text-muted-foreground">Tell us about your firm</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <Label htmlFor="firmName">Firm Name *</Label>
            <Input
              id="firmName"
              value={data.firmName}
              onChange={(e) => onChange({ ...data, firmName: e.target.value })}
              placeholder="Enter your firm name"
              className="input-premium mt-2"
            />
          </div>
          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              value={data.gstin}
              onChange={(e) => onChange({ ...data, gstin: e.target.value })}
              placeholder="Enter GSTIN (optional)"
              className="input-premium mt-2"
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={data.address}
              onChange={(e) => onChange({ ...data, address: e.target.value })}
              placeholder="Enter your address (optional)"
              className="input-premium mt-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={data.phone}
                onChange={(e) => onChange({ ...data, phone: e.target.value })}
                placeholder="Phone number (optional)"
                className="input-premium mt-2"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => onChange({ ...data, email: e.target.value })}
                placeholder="Email (optional)"
                className="input-premium mt-2"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} className="rounded-xl">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function EmployeeSetupStep({
  data,
  onChange,
  onToggleDepartment,
  onNext,
  onBack,
}: {
  data: any
  onChange: (data: any) => void
  onToggleDepartment: (dept: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const departments = ["Taxation", "Audit", "Accounting", "Legal", "HR", "IT"]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white/[0.02] border-white/[0.08] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Employee Setup</h2>
            <p className="text-sm text-muted-foreground">Configure your team structure</p>
          </div>
        </div>

        <div className="space-y-6 mb-8">
          <div>
            <Label htmlFor="employeeCount">Number of Employees</Label>
            <Input
              id="employeeCount"
              type="number"
              value={data.employeeCount}
              onChange={(e) => onChange({ ...data, employeeCount: e.target.value })}
              placeholder="Enter number of employees"
              className="input-premium mt-2"
            />
          </div>

          <div>
            <Label>Departments</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {departments.map((dept) => (
                <div
                  key={dept}
                  onClick={() => onToggleDepartment(dept)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                    data.departments.includes(dept)
                      ? "border-primary bg-primary/10"
                      : "border-white/[0.08] hover:border-white/[0.16]"
                  )}
                >
                  <Checkbox
                    checked={data.departments.includes(dept)}
                    onChange={() => onToggleDepartment(dept)}
                  />
                  <span className="text-sm">{dept}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} className="rounded-xl">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function ServiceConfigurationStep({
  data,
  onChange,
  onToggleService,
  onNext,
  onBack,
}: {
  data: any
  onChange: (data: any) => void
  onToggleService: (service: string) => void
  onNext: () => void
  onBack: () => void
}) {
  const services = [
    { id: "gst", name: "GST Compliance", icon: FileText },
    { id: "tds", name: "TDS Returns", icon: FileText },
    { id: "income-tax", name: "Income Tax", icon: FileText },
    { id: "roc", name: "ROC Filings", icon: FileText },
    { id: "audit", name: "Audit Services", icon: FileText },
    { id: "bookkeeping", name: "Bookkeeping", icon: FileText },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white/[0.02] border-white/[0.08] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Service Configuration</h2>
            <p className="text-sm text-muted-foreground">Select services you offer</p>
          </div>
        </div>

        <div className="space-y-6 mb-8">
          <div className="grid grid-cols-2 gap-3">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => onToggleService(service.id)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                  data.services.includes(service.id)
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] hover:border-white/[0.16]"
                )}
              >
                <Checkbox
                  checked={data.services.includes(service.id)}
                  onChange={() => onToggleService(service.id)}
                />
                <service.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{service.name}</span>
              </div>
            ))}
          </div>

          <div>
            <Label htmlFor="reminderDays">Default Reminder Days</Label>
            <Input
              id="reminderDays"
              type="number"
              value={data.defaultReminderDays}
              onChange={(e) => onChange({ ...data, defaultReminderDays: parseInt(e.target.value) })}
              className="input-premium mt-2"
            />
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} className="rounded-xl">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function ClientImportStep({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: any
  onChange: (data: any) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white/[0.02] border-white/[0.08] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Client Import</h2>
            <p className="text-sm text-muted-foreground">Import your existing clients</p>
          </div>
        </div>

        <div className="space-y-6 mb-8">
          <div>
            <Label>Import Method</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div
                onClick={() => onChange({ ...data, importMethod: "manual" })}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                  data.importMethod === "manual"
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] hover:border-white/[0.16]"
                )}
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Manual Entry</p>
                  <p className="text-xs text-muted-foreground">Add clients one by one</p>
                </div>
              </div>
              <div
                onClick={() => onChange({ ...data, importMethod: "csv" })}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors",
                  data.importMethod === "csv"
                    ? "border-primary bg-primary/10"
                    : "border-white/[0.08] hover:border-white/[0.16]"
                )}
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">CSV Import</p>
                  <p className="text-xs text-muted-foreground">Bulk import from file</p>
                </div>
              </div>
            </div>
          </div>

          {data.importMethod === "csv" && (
            <div>
              <Label htmlFor="clientCount">Number of Clients to Import</Label>
              <Input
                id="clientCount"
                type="number"
                value={data.clientCount}
                onChange={(e) => onChange({ ...data, clientCount: e.target.value })}
                placeholder="Enter number of clients"
                className="input-premium mt-2"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} className="rounded-xl">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function NotificationPreferencesStep({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: any
  onChange: (data: any) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="bg-white/[0.02] border-white/[0.08] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Notification Preferences</h2>
            <p className="text-sm text-muted-foreground">Configure your notifications</p>
          </div>
        </div>

        <div className="space-y-6 mb-8">
          <div className="space-y-3">
            <div
              onClick={() => onChange({ ...data, emailEnabled: !data.emailEnabled })}
              className="flex items-center justify-between p-4 rounded-lg border border-white/[0.08] cursor-pointer hover:border-white/[0.16] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive updates via email</p>
                </div>
              </div>
              <Checkbox checked={data.emailEnabled} onChange={() => onChange({ ...data, emailEnabled: !data.emailEnabled })} />
            </div>

            <div
              onClick={() => onChange({ ...data, smsEnabled: !data.smsEnabled })}
              className="flex items-center justify-between p-4 rounded-lg border border-white/[0.08] cursor-pointer hover:border-white/[0.16] transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">SMS Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive updates via SMS</p>
                </div>
              </div>
              <Checkbox checked={data.smsEnabled} onChange={() => onChange({ ...data, smsEnabled: !data.smsEnabled })} />
            </div>

            <div
              onClick={() => onChange({ ...data, whatsappEnabled: !data.whatsappEnabled })}
              className="flex items-center justify-between p-4 rounded-lg border border-white/[0.08] cursor-pointer hover:border-white/[0.16] transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">WhatsApp Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive updates via WhatsApp</p>
                </div>
              </div>
              <Checkbox checked={data.whatsappEnabled} onChange={() => onChange({ ...data, whatsappEnabled: !data.whatsappEnabled })} />
            </div>
          </div>

          <div>
            <Label htmlFor="frequency">Reminder Frequency</Label>
            <Select
              value={data.reminderFrequency}
              onValueChange={(value) => onChange({ ...data, reminderFrequency: value })}
            >
              <SelectTrigger className="input-premium mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} className="rounded-xl">
            Complete Setup
            <Check className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}
