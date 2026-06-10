import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, BarChart3, CreditCard, DollarSign, Receipt } from "lucide-react"

import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/dashboard/glass-card"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Breadcrumb } from "@/components/navigation/breadcrumb"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth/session"

export default async function PaymentsPage() {
  // C-10 fix: enforce authentication before any DB access
  const session = await getSession()
  if (!session) {
    redirect("/login")
  }
  if (session.user.role !== "PARTNER" && session.user.role !== "MANAGER") {
    redirect("/unauthorized")
  }

  // Fetch real metrics from Prisma
  const totalInvoicesResult = await prisma.invoice.aggregate({
    _sum: { amount: true, outstandingAmount: true, paidAmount: true },
  })

  const overdueInvoicesResult = await prisma.invoice.aggregate({
    where: { status: "OVERDUE" },
    _sum: { outstandingAmount: true },
  })

  // Simple ageing buckets logic in memory for now
  const allInvoices = await prisma.invoice.findMany({
    where: { outstandingAmount: { gt: 0 } },
    select: { dueDate: true, outstandingAmount: true }
  })

  // Serialize Decimal objects to numbers for client components
  const serializedInvoices = allInvoices.map(inv => ({
    ...inv,
    outstandingAmount: Number(inv.outstandingAmount),
  }))

  const now = new Date()
  let bucket30 = 0
  let bucket60 = 0
  let bucket90 = 0
  let bucket90Plus = 0

  serializedInvoices.forEach(inv => {
    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 3600 * 24))
    if (daysOverdue <= 0) return // not overdue yet
    const amt = inv.outstandingAmount
    if (daysOverdue <= 30) bucket30 += amt
    else if (daysOverdue <= 60) bucket60 += amt
    else if (daysOverdue <= 90) bucket90 += amt
    else bucket90Plus += amt
  })

  const totalOutstanding = Number(totalInvoicesResult._sum.outstandingAmount || 0)
  const totalCollected = Number(totalInvoicesResult._sum.paidAmount || 0)
  const totalOverdue = Number(overdueInvoicesResult._sum.outstandingAmount || 0)

  return (
    <PageContainer className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Payments", href: "/payments" },
          { label: "Invoices" },
        ]}
      />
      <PageHeader
        label="Payment tracking"
        title="Payments Dashboard"
        description="Monitor invoice collections, outstanding balances, and ageing analysis across your client portfolio."
        action={
          <Button asChild className="btn-glow">
            <Link href="/payments/invoices">
              View All Invoices
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard glow className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Total Collected
              </p>
              <p className="text-2xl font-semibold mt-2">₹{totalCollected.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Lifetime collections</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
          </div>
        </GlassCard>
        <GlassCard glow className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Outstanding Balance
              </p>
              <p className="text-2xl font-semibold mt-2">₹{totalOutstanding.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Pending invoices</p>
            </div>
            <div className="p-3 rounded-xl bg-sky-500/10">
              <Receipt className="h-5 w-5 text-sky-400" />
            </div>
          </div>
        </GlassCard>
        <GlassCard glow className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Total Overdue
              </p>
              <p className="text-2xl font-semibold mt-2 text-destructive">₹{totalOverdue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Requires immediate attention</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10">
              <CreditCard className="h-5 w-5 text-red-400" />
            </div>
          </div>
        </GlassCard>
        <GlassCard glow className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Overdue Rate
              </p>
              <p className="text-2xl font-semibold mt-2">
                {totalOutstanding > 0 ? ((totalOverdue / totalOutstanding) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">Of outstanding balance</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10">
              <BarChart3 className="h-5 w-5 text-amber-400" />
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard hover={false} className="lg:col-span-2 p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Ageing Analysis</h3>
            <p className="text-sm text-muted-foreground">Outstanding balance categorized by days overdue.</p>
          </div>
          <div className="flex h-[200px] items-end justify-around space-x-2 pb-4">
            <div className="group relative flex w-1/4 flex-col items-center justify-end">
              <div className="w-full bg-blue-500 rounded-t-md transition-all duration-300" style={{ height: `${Math.max(10, (bucket30 / (totalOverdue || 1)) * 100)}%` }} />
              <span className="mt-2 text-xs text-muted-foreground">0-30 Days</span>
              <span className="absolute -top-6 text-xs font-semibold">₹{bucket30.toLocaleString()}</span>
            </div>
            <div className="group relative flex w-1/4 flex-col items-center justify-end">
              <div className="w-full bg-yellow-500 rounded-t-md transition-all duration-300" style={{ height: `${Math.max(10, (bucket60 / (totalOverdue || 1)) * 100)}%` }} />
              <span className="mt-2 text-xs text-muted-foreground">31-60 Days</span>
              <span className="absolute -top-6 text-xs font-semibold">₹{bucket60.toLocaleString()}</span>
            </div>
            <div className="group relative flex w-1/4 flex-col items-center justify-end">
              <div className="w-full bg-orange-500 rounded-t-md transition-all duration-300" style={{ height: `${Math.max(10, (bucket90 / (totalOverdue || 1)) * 100)}%` }} />
              <span className="mt-2 text-xs text-muted-foreground">61-90 Days</span>
              <span className="absolute -top-6 text-xs font-semibold">₹{bucket90.toLocaleString()}</span>
            </div>
            <div className="group relative flex w-1/4 flex-col items-center justify-end">
              <div className="w-full bg-red-500 rounded-t-md transition-all duration-300" style={{ height: `${Math.max(10, (bucket90Plus / (totalOverdue || 1)) * 100)}%` }} />
              <span className="mt-2 text-xs text-muted-foreground">&gt;90 Days</span>
              <span className="absolute -top-6 text-xs text-destructive font-semibold">₹{bucket90Plus.toLocaleString()}</span>
            </div>
          </div>
        </GlassCard>
        <GlassCard hover={false} className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold">Action Needed</h3>
            <p className="text-sm text-muted-foreground">Top overdue clients</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">No overdue clients yet.</p>
                <p className="text-sm text-muted-foreground">Keep up the good work!</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </PageContainer>
  )
}
