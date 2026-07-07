"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Book,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Mail,
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
    answer:
      "Go to the Clients page and click 'Add Client'. The onboarding wizard walks you through the basics — name, GSTIN, PAN, contact details — then services and compliance setup.",
    category: "clients",
  },
  {
    question: "How do I create a new filing task?",
    answer:
      "Click 'New Filing' in the top bar (or go to Compliance → Add Filing) to create a compliance filing. For general work items, use the Work Tracker's Create Task button.",
    category: "tasks",
  },
  {
    question: "How do I send an invoice to a client?",
    answer:
      "Go to Payments → Invoices and click 'New Invoice'. Clients see their invoices (with bank/UPI payment instructions and a PDF download) in their client portal.",
    category: "payments",
  },
  {
    question: "How do compliance reminders work?",
    answer:
      "J-TACS automatically emails clients when a filing enters its reminder window (set per filing). Staff get in-app notifications for overdue tasks and approaching deadlines.",
    category: "compliance",
  },
  {
    question: "How do team members get their logins?",
    answer:
      "When a Partner adds an employee or manager on the Employees page, a login is created automatically — the new hire gets an invite email with a temporary password, and the Partner also sees the password once as a backup. They choose their own password at first sign-in.",
    category: "general",
  },
  {
    question: "How do I track GST filings?",
    answer:
      "Use the Compliance page to view all GST-related filings. Filter by type (GSTR-1, GSTR-3B, GSTR-9) and status. Each filing shows its current workflow stage.",
    category: "compliance",
  },
  {
    question: "How do I generate reports?",
    answer:
      "Go to the Reports page to access revenue, filing status, and client analytics. Reports export as PDF, Excel, or CSV.",
    category: "reports",
  },
  {
    question: "How do I set up branded email sending?",
    answer:
      "Settings → Firm Details holds your firm name and sender email; the Domain Verification card walks you through the DNS records. Until your domain is verified, emails go out via the platform address with your firm's name and reply-to.",
    category: "general",
  },
]

const GUIDES = [
  {
    id: "getting-started",
    title: "Getting Started with J-TACS",
    description: "Learn the basics of setting up your firm and managing clients.",
    category: "basics",
    sections: [
      "Set your firm profile in Settings → Firm Details (name, sender email, payment details).",
      "Add team members from the Employees page — logins and invite emails are created automatically.",
      "Add clients via Clients → Add Client; the wizard covers services and compliance setup.",
      "Check the dashboard's setup checklist to see what's left.",
    ],
  },
  {
    id: "client-management",
    title: "Client Management",
    description: "Client onboarding, document management, and communication.",
    category: "clients",
    sections: [
      "Each client's 360 page (click a client) shows tasks, invoices, documents, compliance, and timeline.",
      "Upload documents from the Documents vault or the client's quick actions.",
      "Email a client from Messaging (or 'Send Reminder' on the client row).",
      "Clients with an email on their record can log into the client portal.",
    ],
  },
  {
    id: "compliance-workflow",
    title: "Compliance Workflow",
    description: "Managing GST, TDS, ITR, and ROC filings.",
    category: "compliance",
    sections: [
      "Create filings manually (New Filing) or let the recurring engine generate statutory ones monthly.",
      "Each filing tracks a workflow: Not Started → Documents Awaited → In Progress → Under Review → Filed.",
      "The Calendar page shows everything by month; Compliance shows status and scores.",
      "Clients are emailed automatically when a filing enters its reminder window.",
    ],
  },
  {
    id: "billing-invoices",
    title: "Billing & Invoicing",
    description: "Invoicing, payment tracking, and outstanding amounts.",
    category: "payments",
    sections: [
      "Create invoices from Payments → Invoices → New Invoice.",
      "Record payments and follow-ups from the invoice's detail page.",
      "Clients see invoices, payment instructions (your bank/UPI from Settings), and PDFs in their portal.",
      "The Payments dashboard shows ageing buckets and the top overdue clients.",
    ],
  },
]

type TabType = "guides" | "faq"

interface HelpCenterProps {
  open?: boolean
  onClose?: () => void
}

export function HelpCenter({ open = true, onClose }: HelpCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>("guides")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null)

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
      role="dialog"
      aria-modal="true"
      aria-label="Help Center"
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
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close help center">
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
              aria-label="Search help articles"
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
                    No guides found for &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  filteredGuides.map((guide) => (
                    <Card
                      key={guide.id}
                      className={cn(
                        "overflow-hidden transition-all",
                        expandedGuide === guide.id && "border-primary"
                      )}
                    >
                      <button
                        className="w-full flex items-start justify-between p-4 text-left"
                        onClick={() =>
                          setExpandedGuide(expandedGuide === guide.id ? null : guide.id)
                        }
                        aria-expanded={expandedGuide === guide.id}
                      >
                        <div>
                          <h3 className="font-medium">{guide.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {guide.description}
                          </p>
                        </div>
                        {expandedGuide === guide.id ? (
                          <ChevronDown className="size-4 shrink-0 mt-1" />
                        ) : (
                          <ChevronRight className="size-4 shrink-0 mt-1" />
                        )}
                      </button>
                      {expandedGuide === guide.id && (
                        <motion.ol
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="px-4 pb-4 space-y-2 list-decimal list-inside"
                        >
                          {guide.sections.map((section) => (
                            <li key={section} className="text-sm text-muted-foreground">
                              {section}
                            </li>
                          ))}
                        </motion.ol>
                      )}
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
                    No FAQs found for &quot;{searchQuery}&quot;
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
                        aria-expanded={expandedFaq === idx}
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
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Setting up branded email?
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/docs/email-setup" onClick={onClose}>
              <Mail className="size-3.5 mr-1.5" />
              Email Setup Guide
            </Link>
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
      aria-label="Open help center"
    >
      <HelpCircle className="size-4" />
    </Button>
  )
}
