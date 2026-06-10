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
  /** Optional callback to open an in-page dialog/sheet (replaces dead href links) */
  onAction?: () => void
}

export function EmptyState({ type, className, onAction }: EmptyStateProps) {
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
              Get started by adding your first client. Use the <span className="font-medium text-foreground">Add Client</span> button in the top-right to create a client profile.
            </p>
            {onAction && (
              <Button onClick={onAction}>
                <Plus className="size-4 mr-2" />
                Add Client
              </Button>
            )}
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
            <h3 className="text-lg font-semibold mb-2">No tasks here</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Tasks are created for each client filing. Use the <span className="font-medium text-foreground">Add Task</span> button to create your first work item.
            </p>
            <div className="flex gap-3">
              {onAction ? (
                <Button onClick={onAction}>
                  <Plus className="size-4 mr-2" />
                  Create Task
                </Button>
              ) : null}
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
            <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Upload documents to keep all client files organised and accessible. Use the <span className="font-medium text-foreground">Upload Document</span> button above.
            </p>
            {onAction && (
              <Button onClick={onAction}>
                <Upload className="size-4 mr-2" />
                Upload Document
              </Button>
            )}
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
              Create invoices to track payments and manage billing. Use the <span className="font-medium text-foreground">Create Invoice</span> button above to get started.
            </p>
            {onAction && (
              <Button onClick={onAction}>
                <Plus className="size-4 mr-2" />
                Create Invoice
              </Button>
            )}
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
              Compliance events are automatically created when you add clients with active services. Add a client with GST, TDS, or Income Tax services to see deadlines here.
            </p>
            <Button variant="outline" asChild>
              <Link href="/clients">
                <ArrowRight className="size-4 mr-2" />
                Go to Clients
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
              Use the <span className="font-medium text-foreground">Compose</span> button to send a message to your clients via email or WhatsApp.
            </p>
            {onAction && (
              <Button onClick={onAction}>
                <Plus className="size-4 mr-2" />
                Compose Message
              </Button>
            )}
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
              Try adjusting your search terms or filters to find what you&apos;re looking for.
            </p>
            {onAction && (
              <Button variant="outline" onClick={onAction}>
                Clear Search
              </Button>
            )}
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

const INLINE_ICON_MAP = {
  clients: Users,
  tasks: CheckSquare,
  documents: FileText,
  payments: Receipt,
} as const

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
  action?: { label: string; href?: string; onClick?: () => void; icon?: React.ElementType }
  className?: string
}) {
  const Icon = (type ? INLINE_ICON_MAP[type] : undefined) ?? Sparkles

  return (
    <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-sm mb-4">{description}</p>
      {action && (
        action.href ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={action.href}>
              {action.icon && <action.icon className="size-3.5 mr-1.5" />}
              {action.label}
            </Link>
          </Button>
        ) : action.onClick ? (
          <Button size="sm" variant="outline" onClick={action.onClick}>
            {action.icon && <action.icon className="size-3.5 mr-1.5" />}
            {action.label}
          </Button>
        ) : null
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
