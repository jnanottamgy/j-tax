"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Book,
  HelpCircle,
  PlayCircle,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Help content data
const FAQS = [
  {
    question: "How do I add a new client?",
    answer: "Go to the Clients page and click 'Add Client'. Fill in the required information including name, email, PAN, and GSTIN. You can also import multiple clients via CSV by clicking the 'Import' button.",
    category: "clients",
  },
  {
    question: "How do I create a new filing task?",
    answer: "Navigate to the Work Tracker page and click 'New Filing'. Select the client, filing type, and due date. Assign it to a team member and set the priority level.",
    category: "tasks",
  },
  {
    question: "How do I send an invoice to a client?",
    answer: "Go to the Payments page, click 'New Invoice', select the client, add line items, and click 'Send'. The invoice will be emailed to the client with a payment link.",
    category: "payments",
  },
  {
    question: "How do compliance reminders work?",
    answer: "J-TAX automatically sends reminders based on due dates. You can configure reminder timing in Settings > Notifications. Reminders are sent via email, SMS, and WhatsApp.",
    category: "compliance",
  },
  {
    question: "Can I import data from other software?",
    answer: "Yes! J-TAX supports CSV import for clients, tasks, and historical data. Go to Settings > Import to get started. We also offer migration assistance for large datasets.",
    category: "general",
  },
  {
    question: "How do I track GST filings?",
    answer: "Use the Compliance page to view all GST-related filings. Filter by type (GSTR-1, GSTR-3B, GSTR-9) and status. Each filing shows its current workflow stage.",
    category: "compliance",
  },
  {
    question: "How do I generate reports?",
    answer: "Go to the Reports page to access various reports including revenue, filing status, and client analytics. Reports can be exported as PDF or Excel.",
    category: "reports",
  },
  {
    question: "How secure is my data?",
    answer: "J-TAX uses enterprise-grade encryption and is hosted on secure cloud infrastructure. All data is backed up daily and we comply with Indian data protection regulations.",
    category: "security",
  },
]

const GUIDES = [
  {
    id: "getting-started",
    title: "Getting Started with J-TAX",
    description: "Learn the basics of setting up your firm and managing clients.",
    duration: "10 min read",
    category: "basics",
    sections: [
      "Creating your firm profile",
      "Adding team members",
      "Importing clients",
      "Setting up notifications",
    ],
  },
  {
    id: "client-management",
    title: "Client Management Guide",
    description: "Master client onboarding, document management, and communication.",
    duration: "15 min read",
    category: "clients",
    sections: [
      "Adding and organizing clients",
      "Client profiles and details",
      "Document management",
      "Client communication",
    ],
  },
  {
    id: "compliance-workflow",
    title: "Compliance Workflow",
    description: "Complete guide to managing GST, TDS, and ROC filings.",
    duration: "20 min read",
    category: "compliance",
    sections: [
      "Understanding compliance types",
      "Creating filing tasks",
      "Tracking progress",
      "Handling overdue filings",
    ],
  },
  {
    id: "billing-invoices",
    title: "Billing & Invoicing",
    description: "Set up invoicing, track payments, and manage outstanding amounts.",
    duration: "12 min read",
    category: "payments",
    sections: [
      "Creating invoices",
      "Payment tracking",
      "Handling overdue payments",
      "Generating billing reports",
    ],
  },
]

const TUTORIALS = [
  {
    id: "quick-start",
    title: "Quick Start Video",
    description: "5-minute overview of J-TAX key features.",
    duration: "5:00",
    thumbnail: "quick-start",
  },
  {
    id: "client-onboarding",
    title: "Client Onboarding Workflow",
    description: "Step-by-step guide to adding and managing clients.",
    duration: "8:30",
    thumbnail: "client-onboarding",
  },
  {
    id: "filing-tasks",
    title: "Creating Filing Tasks",
    description: "How to create, assign, and track compliance tasks.",
    duration: "6:45",
    thumbnail: "filing-tasks",
  },
  {
    id: "invoice-management",
    title: "Invoice Management",
    description: "Creating and managing invoices effectively.",
    duration: "7:20",
    thumbnail: "invoice-management",
  },
]

type TabType = "guides" | "faq" | "tutorials"

interface HelpCenterProps {
  open?: boolean
  onClose?: () => void
}

export function HelpCenter({ open = true, onClose }: HelpCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>("guides")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const filteredFaqs = useMemo(() => {
    if (!searchQuery) return FAQS
    return FAQS.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  const filteredGuides = useMemo(() => {
    if (!searchQuery) return GUIDES
    return GUIDES.filter(
      (guide) =>
        guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-3xl max-h-[80vh] bg-background overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            <h2 className="font-semibold">Help Center</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "guides"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("guides")}
          >
            <Book className="size-4 inline mr-1.5" />
            Guides
          </button>
          <button
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "faq"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("faq")}
          >
            <HelpCircle className="size-4 inline mr-1.5" />
            FAQ
          </button>
          <button
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "tutorials"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("tutorials")}
          >
            <PlayCircle className="size-4 inline mr-1.5" />
            Tutorials
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(80vh - 200px)" }}>
          <AnimatePresence mode="wait">
            {activeTab === "guides" && (
              <motion.div
                key="guides"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {filteredGuides.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No guides found for "{searchQuery}"
                  </div>
                ) : (
                  filteredGuides.map((guide) => (
                    <Card
                      key={guide.id}
                      className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{guide.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {guide.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {guide.duration}
                          </p>
                        </div>
                        <ExternalLink className="size-4 text-muted-foreground" />
                      </div>
                    </Card>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === "faq" && (
              <motion.div
                key="faq"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No FAQs found for "{searchQuery}"
                  </div>
                ) : (
                  filteredFaqs.map((faq, idx) => (
                    <Card
                      key={idx}
                      className={cn(
                        "overflow-hidden transition-all",
                        expandedFaq === idx && "border-primary"
                      )}
                    >
                      <button
                        className="w-full flex items-center justify-between p-4 text-left"
                        onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                      >
                        <span className="font-medium text-sm pr-4">{faq.question}</span>
                        {expandedFaq === idx ? (
                          <ChevronDown className="size-4 shrink-0" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0" />
                        )}
                      </button>
                      {expandedFaq === idx && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          className="px-4 pb-4"
                        >
                          <p className="text-sm text-muted-foreground">
                            {faq.answer}
                          </p>
                        </motion.div>
                      )}
                    </Card>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === "tutorials" && (
              <motion.div
                key="tutorials"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 gap-4"
              >
                {TUTORIALS.map((tutorial) => (
                  <Card
                    key={tutorial.id}
                    className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <PlayCircle className="size-10 text-muted-foreground" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-sm">{tutorial.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tutorial.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {tutorial.duration}
                      </p>
                    </div>
                  </Card>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Can't find what you're looking for?
          </p>
          <Button variant="outline" size="sm">
            <MessageCircle className="size-3.5 mr-1.5" />
            Contact Support
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

// Help button component for the header
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title="Help Center"
    >
      <HelpCircle className="size-4" />
    </Button>
  )
}