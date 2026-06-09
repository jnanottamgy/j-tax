import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Receipt, Download, CreditCard, CheckCircle2, AlertCircle, Clock } from "lucide-react"

import { getSession } from "@/lib/auth/session"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default async function ClientInvoicesPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  // Find the Client record for this user
  const clientRecord = await prisma.client.findFirst({
    where: { email: session.user.email },
    select: { id: true, name: true },
  })

  if (!clientRecord) {
    redirect("/unauthorized")
  }

  // Fetch invoices and payments for this client
  const [invoices, paymentHistory] = await Promise.all([
    prisma.invoice.findMany({
      where: { clientId: clientRecord.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.paymentReceipt.findMany({
      where: {
        invoice: {
          clientId: clientRecord.id,
        },
      },
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: 20,
    }),
  ])

  // Serialize Decimal objects to numbers for client components
  const serializedInvoices = invoices.map(invoice => ({
    ...invoice,
    amount: Number(invoice.amount),
    paidAmount: Number(invoice.paidAmount),
    outstandingAmount: Number(invoice.outstandingAmount),
  }))

  const serializedPaymentHistory = paymentHistory.map(payment => ({
    ...payment,
    amount: Number(payment.amount),
  }))

  // Calculate totals
  const totalOutstanding = serializedInvoices.reduce(
    (sum, inv) => sum + inv.outstandingAmount,
    0
  )
  const totalOverdue = serializedInvoices
    .filter((inv) => inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + inv.outstandingAmount, 0)
  const totalPaid = serializedPaymentHistory.reduce(
    (sum, p) => sum + p.amount,
    0
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="size-3 mr-1" />
            Paid
          </Badge>
        )
      case "OVERDUE":
        return (
          <Badge variant="destructive">
            <AlertCircle className="size-3 mr-1" />
            Overdue
          </Badge>
        )
      case "SENT":
        return (
          <Badge variant="secondary">
            <Clock className="size-3 mr-1" />
            Pending
          </Badge>
        )
      case "PARTIALLY_PAID":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            Partially Paid
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  function formatCurrency(amount: number | string | { toNumber(): number }): string {
    const num = typeof amount === "object" && "toNumber" in amount ? amount.toNumber() : Number(amount)
    return `₹${num.toLocaleString("en-IN")}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices & Payments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View your invoices and payment history.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outstanding
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Receipt className="size-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Across all invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Amount
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-red-500/10">
              <AlertCircle className="size-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-green-500/10">
              <CheckCircle2 className="size-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invoices
            </CardTitle>
            <div className="p-1.5 rounded-lg bg-purple-500/10">
              <Receipt className="size-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serializedInvoices.length}</div>
            <p className="text-xs text-muted-foreground">All invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="size-5" />
                Invoices
              </CardTitle>
              <CardDescription>
                All invoices and their payment status
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="size-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No invoices yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Invoices will appear here when created by your tax team.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left py-3 px-3 font-medium">Invoice #</th>
                    <th className="text-left py-3 px-3 font-medium">Issue Date</th>
                    <th className="text-left py-3 px-3 font-medium">Due Date</th>
                    <th className="text-left py-3 px-3 font-medium">Amount</th>
                    <th className="text-left py-3 px-3 font-medium">Paid</th>
                    <th className="text-left py-3 px-3 font-medium">Outstanding</th>
                    <th className="text-left py-3 px-3 font-medium">Status</th>
                    <th className="text-left py-3 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/50 transition-colors",
                        invoice.status === "OVERDUE" && "bg-red-500/5"
                      )}
                    >
                      <td className="py-3 px-3 font-medium">
                        #{invoice.invoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {format(new Date(invoice.issueDate), "MMM d, yyyy")}
                      </td>
                      <td className="py-3 px-3 text-sm">
                        <div className="flex items-center gap-2">
                          {new Date(invoice.dueDate) < new Date() &&
                            invoice.status !== "PAID" && (
                              <AlertCircle className="size-3.5 text-red-500" />
                            )}
                          {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="py-3 px-3 text-sm text-green-600">
                        {formatCurrency(invoice.paidAmount)}
                      </td>
                      <td className="py-3 px-3 font-medium">
                        {formatCurrency(invoice.outstandingAmount)}
                      </td>
                      <td className="py-3 px-3">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          {invoice.status !== "PAID" && (
                            <Button size="sm" variant="outline" className="h-8">
                              <CreditCard className="size-3.5 mr-1" />
                              Pay
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5" />
                Payment History
              </CardTitle>
              <CardDescription>
                Record of all payments made
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {serializedPaymentHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CreditCard className="size-12 text-muted-foreground/30 mb-4" />
              <p className="font-medium">No payment history</p>
              <p className="text-sm text-muted-foreground mt-1">
                Payment records will appear here once you start making payments.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {serializedPaymentHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle2 className="size-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Invoice #{payment.invoice.invoiceNumber} •{" "}
                        {payment.method || "Payment"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {format(new Date(payment.paymentDate), "MMM d, yyyy")}
                    </p>
                    {payment.reference && (
                      <p className="text-xs text-muted-foreground">
                        Ref: {payment.reference}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Receipt className="size-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Payment Methods</p>
              <p className="text-sm text-muted-foreground mt-1">
                We accept bank transfers, UPI, and checks. For payment inquiries, please contact{" "}
                <a href="/client/messages" className="underline hover:text-blue-500">
                  our team
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}