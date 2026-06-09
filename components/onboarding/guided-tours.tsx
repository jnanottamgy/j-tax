"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  ChevronRight,
  ChevronLeft,
  Home,
  Users,
  CheckSquare,
  CreditCard,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type TourType = "dashboard" | "clients" | "tasks" | "payments"

interface TourStep {
  title: string
  description: string
  targetElement?: string
  tip?: string
}

interface TourConfig {
  id: TourType
  name: string
  icon: React.ElementType
  steps: TourStep[]
}

const TOURS: TourConfig[] = [
  {
    id: "dashboard",
    name: "Dashboard Tour",
    icon: Home,
    steps: [
      {
        title: "Welcome to Your Dashboard",
        description: "This is your command center. Here you can see an overview of your entire tax practice at a glance.",
        tip: "You can always come back here to get a quick snapshot of your work.",
      },
      {
        title: "Key Metrics",
        description: "The top cards show important metrics like total clients, revenue, and compliance scores. Click any card to dive deeper.",
      },
      {
        title: "Charts & Analytics",
        description: "Visual charts help you understand trends in your filings and revenue over time.",
      },
      {
        title: "Recent Activity",
        description: "Stay updated with the latest actions across your practice. This feed shows all recent changes.",
      },
      {
        title: "Quick Actions",
        description: "Use the 'New Filing' button to quickly create new tasks, or use the search bar (⌘K) for fast navigation.",
      },
    ],
  },
  {
    id: "clients",
    name: "Clients Tour",
    icon: Users,
    steps: [
      {
        title: "Client Management",
        description: "This is where you manage all your clients. Each client has a comprehensive profile with all their information.",
      },
      {
        title: "Client List",
        description: "View all clients with their status, priority, and assigned team members. Use filters to find specific clients quickly.",
      },
      {
        title: "Add New Client",
        description: "Click 'Add Client' to create a new client profile. You can also import multiple clients via CSV.",
      },
      {
        title: "Client Details",
        description: "Click any client to see their complete profile including compliance history, documents, and invoices.",
      },
    ],
  },
  {
    id: "tasks",
    name: "Tasks Tour",
    icon: CheckSquare,
    steps: [
      {
        title: "Work Tracker",
        description: "Manage all your filing tasks in one place. Track progress from 'Not Started' to 'Filed'.",
      },
      {
        title: "Task Board",
        description: "Tasks are organized by status. Drag and drop to update progress, or click to edit details.",
      },
      {
        title: "Task Assignment",
        description: "Assign tasks to team members and set priorities. Urgent tasks appear at the top.",
      },
      {
        title: "Due Dates",
        description: "Never miss a deadline. Overdue tasks are highlighted in red, and upcoming deadlines show in yellow.",
      },
    ],
  },
  {
    id: "payments",
    name: "Payments Tour",
    icon: CreditCard,
    steps: [
      {
        title: "Payment Center",
        description: "Track all invoices and payments. See outstanding amounts and payment history at a glance.",
      },
      {
        title: "Invoice Management",
        description: "Create, send, and track invoices. Set up recurring invoices for regular clients.",
      },
      {
        title: "Payment Tracking",
        description: "Record payments against invoices. The system automatically calculates outstanding amounts.",
      },
      {
        title: "Overdue Alerts",
        description: "Automatically identify overdue invoices and send payment reminders to clients.",
      },
    ],
  },
]

interface GuidedToursProps {
  available?: boolean
  onComplete?: () => void
}

export function GuidedTours({ available = true, onComplete }: GuidedToursProps) {
  const [activeTour, setActiveTour] = useState<TourType | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isMinimized, setIsMinimized] = useState(false)

  const currentTour = TOURS.find((t) => t.id === activeTour)
  const totalSteps = currentTour?.steps.length ?? 0

  const handleStartTour = (tourId: TourType) => {
    setActiveTour(tourId)
    setCurrentStep(0)
    setIsMinimized(false)
  }

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setActiveTour(null)
    setCurrentStep(0)
    onComplete?.()
  }

  const handleSkip = () => {
    setActiveTour(null)
    setCurrentStep(0)
  }

  // Show tour selector if no tour is active
  if (!activeTour) {
    return (
      <Card className="bg-card border-white/[0.08] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium">Guided Tours</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Learn how to use J-TAX with interactive tours.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TOURS.map((tour) => (
            <Button
              key={tour.id}
              variant="outline"
              size="sm"
              className="justify-start h-auto py-2 px-3"
              onClick={() => handleStartTour(tour.id)}
            >
              <tour.icon className="size-3.5 mr-1.5" />
              <span className="text-xs truncate">{tour.name}</span>
            </Button>
          ))}
        </div>
      </Card>
    )
  }

  const step = currentTour?.steps[currentStep]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]"
    >
      <Card className="bg-card border-primary/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            {currentTour && <currentTour.icon className="size-4 text-primary" />}
            <span className="text-sm font-medium">{currentTour?.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleSkip}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <div className="p-4">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <Badge variant="secondary" className="text-xs">
                Step {currentStep + 1} of {totalSteps}
              </Badge>
              <div className="flex gap-1">
                {currentTour?.steps.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      idx <= currentStep ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2">{step?.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {step?.description}
              </p>
              {step?.tip && (
                <div className="mt-3 p-2 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-[10px] text-primary">
                    💡 Tip: {step.tip}
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="text-xs"
              >
                Previous
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground"
                >
                  Skip
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="text-xs"
                >
                  {currentStep === totalSteps - 1 ? "Finish" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

// Hook to manage tour state in localStorage
export function useTourState() {
  const [completedTours, setCompletedTours] = useState<TourType[]>([])

  useEffect(() => {
    const stored = localStorage.getItem("jtax.completedTours")
    if (stored) {
      setCompletedTours(JSON.parse(stored))
    }
  }, [])

  const markTourComplete = (tourId: TourType) => {
    const updated = [...completedTours, tourId]
    setCompletedTours(updated)
    localStorage.setItem("jtax.completedTours", JSON.stringify(updated))
  }

  const resetTours = () => {
    setCompletedTours([])
    localStorage.removeItem("jtax.completedTours")
  }

  return { completedTours, markTourComplete, resetTours }
}