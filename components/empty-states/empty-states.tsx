"use client"

import {
  Users,
  CheckSquare,
  FileText,
  Receipt,
  Plus,
  Upload,
  ArrowRight,
  Sparkles,
  Clock,
  Search,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  type: "clients" | "tasks" | "documents" | "payments" | "compliance" | "messages" | "search"
  className?: string
}

export function EmptyState({ type, className }: EmptyStateProps) {
  switch (type) {
    case "clients":
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Users className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Get started by adding your first client. You can add clients manually or import them from a CSV file.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/clients/new">
                  <Plus className="size-4 mr-2" />
                  Add Client
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/clients/import">
                  <Upload className="size-4 mr-2" />
                  Import CSV
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )

    case "tasks":
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-blue-500/10 mb-4">
              <CheckSquare className="size-8 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              You have no pending tasks. This is a great time to review completed filings or plan upcoming deadlines.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/work-tracker/new">
                  <Plus className="size-4 mr-2" />
                  Create Task
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/calendar">
                  <Clock className="size-4 mr-2" />
                  View Calendar
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )

    case "documents":
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10 mb-4">
              <FileText className="size-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No documents</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Upload documents to keep all your client files organized and accessible in one place.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/documents/upload">
                  <Upload className="size-4 mr-2" />
                  Upload Document
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/documents/request">
                  <Plus className="size-4 mr-2" />
                  Request Document
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )

    case "payments":
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-purple-500/10 mb-4">
              <Receipt className="size-8 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Create your first invoice to start tracking payments and managing your billing efficiently.
            </p>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/payments/new">
                  <Plus className="size-4 mr-2" />
                  Create Invoice
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/payments/settings">
                  <Sparkles className="size-4 mr-2" />
                  Setup Billing
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )

    case "compliance":
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-orange-500/10 mb-4">
              <FileText className="size-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No compliance events</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Compliance events will be automatically created based on your clients' filing requirements.
            </p>
            <Button variant="outline" asChild>
              <Link href="/compliance/setup">
                <ArrowRight className="size-4 mr-2" />
                Setup Compliance
              </Link>
            </Button>
          </div>
        </Card>
      )

    case "messages":
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-indigo-500/10 mb-4">
              <Users className="size-8 text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Start a conversation with your team or clients. Communication helps keep everyone aligned.
            </p>
            <Button asChild>
              <Link href="/messaging/new">
                <Plus className="size-4 mr-2" />
                New Message
              </Link>
            </Button>
          </div>
        </Card>
      )

    case "search":
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
              <Search className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Try adjusting your search terms or filters to find what you're looking for.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Clear Search
            </Button>
          </div>
        </Card>
      )

    default:
      return (
        <Card className={cn("p-12 text-center", className)}>
          <div className="flex flex-col items-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted mb-4">
              <Sparkles className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nothing here yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              This section is empty. Check back later or explore other features.
            </p>
          </div>
        </Card>
      )
  }
}

// Inline empty state for smaller spaces
export function EmptyStateInline({
  type,
  title,
  description,
  action,
  className,
}: {
  type?: "clients" | "tasks" | "documents" | "payments"
  title: string
  description: string
  action?: { label: string; href: string; icon?: React.ElementType }
  className?: string
}) {
  const getIcon = () => {
    switch (type) {
      case "clients":
        return Users
      case "tasks":
        return CheckSquare
      case "documents":
        return FileText
      case "payments":
        return Receipt
      default:
        return Sparkles
    }
  }

  const Icon = getIcon()

  return (
    <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-sm mb-4">{description}</p>
      {action && (
        <Button size="sm" variant="outline" asChild>
          <Link href={action.href}>
            {action.icon && <action.icon className="size-3.5 mr-1.5" />}
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  )
}

// Loading empty state (skeleton-like)
export function EmptyStateLoading({ className }: { className?: string }) {
  return (
    <Card className={cn("p-12", className)}>
      <div className="flex flex-col items-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted animate-pulse mb-4" />
        <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>
    </Card>
  )
}