"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowRight, ArrowLeft, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface TourStep {
  target: string
  title: string
  description: string
  position: "top" | "bottom" | "left" | "right"
  action?: () => void
}

interface GuidedTourProps {
  steps: TourStep[]
  onComplete: () => void
  onSkip: () => void
  showTour: boolean
}

export function GuidedTour({ steps, onComplete, onSkip, showTour }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!showTour) return

    const element = document.querySelector(steps[currentStep].target) as HTMLElement
    setHighlightedElement(element)

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      element.style.position = "relative"
      element.style.zIndex = "50"
    }

    return () => {
      if (element) {
        element.style.position = ""
        element.style.zIndex = ""
      }
    }
  }, [currentStep, showTour, steps])

  if (!showTour) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const isFirstStep = currentStep === 0

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      if (step.action) step.action()
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onSkip} />

      {/* Highlighted element spotlight */}
      {highlightedElement && (
        <div
          className="fixed z-40 pointer-events-none"
          style={{
            top: highlightedElement.getBoundingClientRect().top - 8,
            left: highlightedElement.getBoundingClientRect().left - 8,
            width: highlightedElement.offsetWidth + 16,
            height: highlightedElement.offsetHeight + 16,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            borderRadius: "12px",
          }}
        />
      )}

      {/* Tour tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed z-50 max-w-md"
          style={{
            top: highlightedElement
              ? highlightedElement.getBoundingClientRect().bottom + 20
              : "50%",
            left: highlightedElement
              ? highlightedElement.getBoundingClientRect().left
              : "50%",
            transform: "translate(-50%, 0)",
          }}
        >
          <Card className="border-white/[0.1] bg-popover/95 backdrop-blur-xl p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onSkip}
                className="ml-2 size-8 shrink-0"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 w-1.5 rounded-full ${
                      index === currentStep
                        ? "bg-primary"
                        : index < currentStep
                        ? "bg-primary/50"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="gap-1"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="gap-1 btn-glow"
                >
                  {isLastStep ? (
                    <>
                      <Check className="size-3.5" />
                      Finish
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

// Pre-defined tour for new users
export const defaultTourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar"]',
    title: "Navigation Sidebar",
    description: "Access all your features from here. Navigate to Clients, Work Tracker, Calendar, Documents, and more.",
    position: "right",
  },
  {
    target: '[data-tour="search"]',
    title: "Global Search",
    description: "Quickly find clients, tasks, invoices, and documents using our powerful search. Press ⌘K to open it anywhere.",
    position: "bottom",
  },
  {
    target: '[data-tour="clients"]',
    title: "Client Management",
    description: "View and manage all your clients. Add new clients, assign employees, and track their compliance status.",
    position: "bottom",
  },
  {
    target: '[data-tour="work-tracker"]',
    title: "Work Tracker",
    description: "Track all your tasks, assign work to employees, and monitor progress with our Kanban-style board.",
    position: "bottom",
  },
  {
    target: '[data-tour="notifications"]',
    title: "Notifications",
    description: "Stay updated with important alerts, task assignments, and compliance reminders.",
    position: "left",
  },
]
