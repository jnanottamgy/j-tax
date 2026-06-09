"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Search, ChevronDown, ChevronUp, Book, Video, MessageCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface FAQItem {
  question: string
  answer: string
  category: string
}

interface Guide {
  title: string
  description: string
  icon: React.ReactNode
  link: string
}

const faqItems: FAQItem[] = [
  {
    category: "Getting Started",
    question: "How do I add my first client?",
    answer: "Navigate to the Clients page and click the 'Add Client' button. Fill in the required information including client name, code, GSTIN, and contact details. You can also assign services and set priority levels.",
  },
  {
    category: "Getting Started",
    question: "How do I assign employees to clients?",
    answer: "When adding or editing a client, you can select an employee from the dropdown menu. You can also bulk assign employees to multiple clients from the Clients page using the bulk actions menu.",
  },
  {
    category: "Work Tracker",
    question: "How do I create and track tasks?",
    answer: "Go to the Work Tracker page and click 'Create Task'. Fill in the task details, assign it to an employee, set the due date and priority. Tasks can be moved between columns (Not Started, In Progress, etc.) using drag and drop.",
  },
  {
    category: "Work Tracker",
    question: "How do I set up recurring tasks?",
    answer: "When creating a task, enable the 'Recurring' option and select the frequency (daily, weekly, monthly, etc.). The system will automatically create new tasks based on your schedule.",
  },
  {
    category: "Compliance",
    question: "How do I track compliance deadlines?",
    answer: "The Calendar page shows all compliance deadlines. You can filter by type (GST, TDS, ROC, etc.) and set up automatic reminders. Compliance events are color-coded by status (scheduled, due, completed, overdue).",
  },
  {
    category: "Compliance",
    question: "How do I generate statutory compliance events?",
    answer: "Navigate to the Calendar page and click 'Generate Statutory Events'. Select the compliance types and time period. The system will automatically create events based on statutory deadlines.",
  },
  {
    category: "Documents",
    question: "How do I upload and organize documents?",
    answer: "Go to the Documents page and click 'Upload Document'. Select the file, choose a category (GST, TDS, ROC, etc.), and optionally add tags. You can create folders and set access permissions.",
  },
  {
    category: "Documents",
    question: "How do I share documents with clients?",
    answer: "When uploading a document, you can mark it as shareable. The system will generate a secure link that you can send to clients. You can also set expiration dates for shared links.",
  },
  {
    category: "Invoicing",
    question: "How do I create and send invoices?",
    answer: "Navigate to the Invoices page and click 'Create Invoice'. Select the client, add line items, set the due date. You can send the invoice directly via email or download it as a PDF.",
  },
  {
    category: "Invoicing",
    question: "How do I track payments?",
    answer: "The Payments page shows all invoices and their payment status. You can record payments manually, and the system will automatically update the outstanding balance. Payment reminders can be automated.",
  },
  {
    category: "Messaging",
    question: "How do I send WhatsApp messages to clients?",
    answer: "Go to the Messaging page and select a client. Choose a message template or create a custom message. The system will send it via WhatsApp API. You can also schedule messages for later delivery.",
  },
  {
    category: "Messaging",
    question: "How do I create message templates?",
    answer: "Navigate to Settings > Message Templates. Create reusable templates with variables like {{client_name}}, {{due_date}}, etc. These can be used for reminders, task assignments, and notifications.",
  },
]

const guides: Guide[] = [
  {
    title: "Quick Start Guide",
    description: "Get up and running in 5 minutes",
    icon: <Book className="size-5" />,
    link: "/guides/quick-start",
  },
  {
    title: "Video Tutorials",
    description: "Watch step-by-step video guides",
    icon: <Video className="size-5" />,
    link: "/guides/videos",
  },
  {
    title: "API Documentation",
    description: "Integrate J-TAX with your tools",
    icon: <ExternalLink className="size-5" />,
    link: "/docs/api",
  },
  {
    title: "Contact Support",
    description: "Get help from our support team",
    icon: <MessageCircle className="size-5" />,
    link: "/support",
  },
]

export function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string>("All")

  const categories = ["All", ...Array.from(new Set(faqItems.map((item) => item.category)))]

  const filteredFAQs = faqItems.filter(
    (item) =>
      (selectedCategory === "All" || item.category === selectedCategory) &&
      (item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search for help..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-premium h-12 rounded-xl pl-11 text-lg"
        />
      </div>

      {/* Quick Guides */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {guides.map((guide, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-card-static border-white/[0.07] p-6 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {guide.icon}
              </div>
              <h3 className="mb-2 font-semibold">{guide.title}</h3>
              <p className="text-sm text-muted-foreground">{guide.description}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* FAQ */}
      <div>
        <h2 className="mb-6 text-2xl font-semibold">Frequently Asked Questions</h2>

        {/* Category Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? "btn-glow" : ""}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFAQs.map((item, index) => (
            <Card
              key={index}
              className="glass-card-static border-white/[0.07] overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(index)}
                className="w-full px-6 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="mb-1 text-xs font-medium text-primary/70">
                      {item.category}
                    </span>
                    <h3 className="font-semibold">{item.question}</h3>
                  </div>
                  {expandedItems.has(index) ? (
                    <ChevronUp className="ml-4 size-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="ml-4 size-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {expandedItems.has(index) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 pb-4 pt-0"
                >
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </motion.div>
              )}
            </Card>
          ))}
        </div>

        {filteredFAQs.length === 0 && (
          <Card className="glass-card-static border-white/[0.07] p-12 text-center">
            <p className="text-muted-foreground">No results found for your search.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
