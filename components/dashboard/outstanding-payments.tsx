"use client"

import Link from "next/link"
import { ArrowRight, Clock, AlertCircle } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { SectionHeading } from "@/components/ui/section-heading"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Invoice {
  id: string
  invoiceNumber: string
  outstandingAmount: any
  dueDate: Date
  status: string
  client: { name: string }
}

function formatCurrency(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  return `₹${n.toLocaleString("en-IN")}`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  OVERDUE: {
    label: "Overdue",
    icon: AlertCircle,
    badge: "border-red-500/25 bg-red-500/10 text-red-400",
  },
  SENT: {
    label: "Due soon",
    icon: Clock,
    badge: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  },
  PARTIALLY_PAID: {
    label: "Partial",
    icon: Clock,
    badge: "border-sky-500/25 bg-sky-500/10 text-sky-400",
  },
}

export function OutstandingPayments({ invoices }: { invoices: Invoice[] }) {
  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + Number(inv.outstandingAmount),
    0
  )

  return (
    <GlassCard className="flex h-full flex-col p-6">
      <SectionHeading
        title="Outstanding Payments"
        description="Accounts receivable requiring follow-up"
        action={
          <div className="text-right">
            <p className="text-xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(totalOutstanding)}
            </p>
            <p className="text-[11px] text-muted-foreground/80">total outstanding</p>
          </div>
        }
      />

      {invoices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No outstanding payments</p>
        </div>
      ) : (
        <ul className="mb-4 flex-1 space-y-2">
          {invoices.map((invoice) => {
            const config = statusConfig[invoice.status] ?? statusConfig.SENT
            const StatusIcon = config.icon
            return (
              <li
                key={invoice.id}
                className="surface-elevated flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invoice.client.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Due {formatDate(invoice.dueDate)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatCurrency(Number(invoice.outstandingAmount))}
                </p>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 gap-1", config.badge)}
                >
                  <StatusIcon className="size-3" />
                  {config.label}
                </Badge>
              </li>
            )
          })}
        </ul>
      )}

      <Button
        variant="outline"
        size="sm"
        className="btn-glow mt-2 h-10 w-full rounded-xl"
        asChild
      >
        <Link href="/payments/invoices">
          View all invoices
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </GlassCard>
  )
}
