export const kpiMetrics = [
  {
    title: "Total Tax Liability",
    value: "$2.84M",
    change: "+12.4%",
    trend: "up" as const,
    period: "vs last quarter",
    icon: "receipt" as const,
  },
  {
    title: "Filings Submitted",
    value: "148",
    change: "+8",
    trend: "up" as const,
    period: "this month",
    icon: "fileCheck" as const,
  },
  {
    title: "Compliance Score",
    value: "96.2%",
    change: "+2.1%",
    trend: "up" as const,
    period: "enterprise avg",
    icon: "shield" as const,
  },
  {
    title: "Outstanding Balance",
    value: "$412K",
    change: "-18.3%",
    trend: "down" as const,
    period: "vs last month",
    icon: "wallet" as const,
  },
]

export const revenueChartData = [
  { month: "Jan", collected: 420, liability: 380 },
  { month: "Feb", collected: 445, liability: 410 },
  { month: "Mar", collected: 510, liability: 465 },
  { month: "Apr", collected: 485, liability: 490 },
  { month: "May", collected: 560, liability: 520 },
  { month: "Jun", collected: 590, liability: 545 },
  { month: "Jul", collected: 620, liability: 580 },
  { month: "Aug", collected: 605, liability: 595 },
  { month: "Sep", collected: 680, liability: 610 },
  { month: "Oct", collected: 710, liability: 640 },
  { month: "Nov", collected: 695, liability: 665 },
  { month: "Dec", collected: 740, liability: 690 },
]

export const complianceItems = [
  {
    jurisdiction: "Federal (IRS)",
    status: "compliant" as const,
    dueDate: "Apr 15, 2026",
    progress: 100,
  },
  {
    jurisdiction: "California FTB",
    status: "attention" as const,
    dueDate: "Apr 15, 2026",
    progress: 78,
  },
  {
    jurisdiction: "New York DTF",
    status: "compliant" as const,
    dueDate: "Mar 15, 2026",
    progress: 100,
  },
  {
    jurisdiction: "Texas Comptroller",
    status: "pending" as const,
    dueDate: "May 15, 2026",
    progress: 45,
  },
  {
    jurisdiction: "Sales Tax Nexus",
    status: "attention" as const,
    dueDate: "Feb 28, 2026",
    progress: 62,
  },
]

export const recentActivity = [
  {
    id: "1",
    action: "Q4 estimated payment submitted",
    entity: "Acme Holdings LLC",
    time: "12 min ago",
    type: "payment" as const,
  },
  {
    id: "2",
    action: "Form 1120-S filed successfully",
    entity: "Northwind Partners",
    time: "1 hr ago",
    type: "filing" as const,
  },
  {
    id: "3",
    action: "Compliance review completed",
    entity: "Vertex Global Inc",
    time: "2 hrs ago",
    type: "review" as const,
  },
  {
    id: "4",
    action: "W-2 batch generated (248 forms)",
    entity: "Summit Retail Group",
    time: "3 hrs ago",
    type: "document" as const,
  },
  {
    id: "5",
    action: "Payment reminder sent",
    entity: "Blue Harbor Logistics",
    time: "5 hrs ago",
    type: "alert" as const,
  },
  {
    id: "6",
    action: "State nexus analysis updated",
    entity: "Orion Tech Solutions",
    time: "Yesterday",
    type: "review" as const,
  },
]

export const tasksDueToday = [
  {
    id: "t1",
    title: "Review CA franchise tax return",
    client: "Acme Holdings LLC",
    priority: "high" as const,
    dueTime: "11:00 AM",
  },
  {
    id: "t2",
    title: "Approve payroll tax deposit",
    client: "Summit Retail Group",
    priority: "high" as const,
    dueTime: "2:00 PM",
  },
  {
    id: "t3",
    title: "Upload supporting documents",
    client: "Northwind Partners",
    priority: "medium" as const,
    dueTime: "4:30 PM",
  },
  {
    id: "t4",
    title: "Sign Form 8879 e-file authorization",
    client: "Vertex Global Inc",
    priority: "medium" as const,
    dueTime: "5:00 PM",
  },
  {
    id: "t5",
    title: "Reconcile Q4 sales tax liability",
    client: "Blue Harbor Logistics",
    priority: "low" as const,
    dueTime: "EOD",
  },
]

export const outstandingPayments = [
  {
    id: "p1",
    client: "Acme Holdings LLC",
    amount: 84200,
    dueDate: "Feb 15, 2026",
    status: "overdue" as const,
  },
  {
    id: "p2",
    client: "Summit Retail Group",
    amount: 128500,
    dueDate: "Mar 1, 2026",
    status: "due_soon" as const,
  },
  {
    id: "p3",
    client: "Orion Tech Solutions",
    amount: 45600,
    dueDate: "Mar 15, 2026",
    status: "pending" as const,
  },
  {
    id: "p4",
    client: "Blue Harbor Logistics",
    amount: 67300,
    dueDate: "Mar 28, 2026",
    status: "pending" as const,
  },
]

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}
