"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  FileText,
  CheckSquare,
  DollarSign,
  Folder,
  Calendar,
  Activity,
  MoreVertical,
  Phone,
  Mail,
  Building2,
  AlertCircle,
  TrendingUp,
  Pencil,
  ListChecks,
  Check,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import {
  setDocumentCollected,
  addChecklistItem,
  removeChecklistItem,
  generateChecklistFromServices,
  getClientChecklist,
} from "@/app/actions/document-checklist"

import { getEmployeesData } from "@/app/actions/employees"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlassCard } from "@/components/dashboard/glass-card"
import { ClientComplianceTab } from "@/components/compliance/client-compliance-tab"
import { ClientTimeline } from "@/components/clients/client-timeline"
import { EditClientDialog } from "@/components/clients/edit-client-dialog"
import type { ClientListItem, EmployeeOption } from "@/lib/clients/types"
import { serviceLabel } from "@/lib/clients/constants"
import { cn } from "@/lib/utils"

type TabType = "overview" | "services" | "tasks" | "payments" | "documents" | "compliance" | "activity" | "timeline"

/** Humanize raw Prisma enum values, e.g. ON_HOLD → "On Hold" */
function humanizeEnum(value?: string | null) {
  if (!value) return "-"
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

interface Client360ClientProps {
  initialData: any
  clientId: string
}

export function Client360Client({ initialData, clientId }: Client360ClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [data, _setData] = useState(initialData)
  const [editOpen, setEditOpen] = useState(false)
  const [employees, setEmployees] = useState<EmployeeOption[] | null>(null)

  const canManage = data.user.role === "PARTNER" || data.user.role === "MANAGER"

  // EditClientDialog expects the table-row shape; adapt the 360 payload.
  const editableClient: ClientListItem = {
    id: data.client.id,
    name: data.client.name,
    code: data.client.clientCode,
    gstin: data.client.gstin ?? null,
    pan: data.client.pan ?? null,
    email: data.client.email ?? null,
    phone: data.client.phone ?? null,
    whatsapp: data.client.whatsapp ?? null,
    address: data.client.address ?? null,
    notes: data.client.notes ?? null,
    assignedEmployeeId: data.client.assignedEmployeeId ?? null,
    assignedEmployee: data.client.assignedEmployee?.name ?? "Unassigned",
    status: data.client.status,
    priority: data.client.priority,
    services: (data.services ?? [])
      .filter((s: any) => s.isActive)
      .map((s: any) => ({
        type: s.serviceType,
        frequency: s.frequency,
        customName: s.customName ?? null,
      })),
    nextDueDate: null,
    createdAt:
      typeof data.client.createdAt === "string"
        ? data.client.createdAt
        : new Date(data.client.createdAt).toISOString(),
  }

  const openEditDialog = async () => {
    if (employees === null) {
      try {
        const result = await getEmployeesData()
        setEmployees(
          result.employees.map((e) => ({
            id: e.id,
            name: e.name,
            department: e.department,
          }))
        )
      } catch {
        toast.error("Couldn't load the employee list — assignment options may be empty.")
        setEmployees([])
      }
    }
    setEditOpen(true)
  }

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: Activity },
    { id: "services" as TabType, label: "Services", icon: Building2 },
    { id: "tasks" as TabType, label: "Tasks", icon: CheckSquare },
    { id: "payments" as TabType, label: "Payments", icon: DollarSign },
    { id: "documents" as TabType, label: "Documents", icon: Folder },
    { id: "compliance" as TabType, label: "Compliance", icon: Calendar },
    { id: "activity" as TabType, label: "Activity", icon: Activity },
    { id: "timeline" as TabType, label: "Timeline", icon: TrendingUp },
  ]

  const quickActions = [
    { label: "Add Task", icon: CheckSquare, href: `/work-tracker?clientId=${clientId}&new=1` },
    // Payments is PARTNER/MANAGER-only — don't show employees a door they can't open
    ...(canManage
      ? [{ label: "Add Invoice", icon: DollarSign, href: `/payments/invoices?clientId=${clientId}&new=1` }]
      : []),
    { label: "Upload Document", icon: Folder, href: `/documents?clientId=${clientId}&upload=1` },
    { label: "Send Reminder", icon: Phone, href: `/messaging?clientId=${clientId}&compose=1` },
  ]

  const metrics = data.metrics || {}

  return (
    <>
      {/* Header */}
      <div className="border-b border-white/[0.08] bg-white/[0.02]">
        <div className="container mx-auto max-w-[1680px] px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link href="/clients">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{data.client.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">{data.client.clientCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="input-premium h-9 rounded-xl border-white/[0.07] bg-transparent">
                      <MoreVertical className="h-4 w-4 mr-2" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void openEditDialog()}>
                      <Pencil className="h-4 w-4" />
                      Edit client details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <InfoCard label="GSTIN" value={data.client.gstin || "-"} icon={Building2} />
            <InfoCard label="PAN" value={data.client.pan || "-"} icon={FileText} />
            <InfoCard label="Email" value={data.client.email || "-"} icon={Mail} />
            <InfoCard label="Phone" value={data.client.phone || "-"} icon={Phone} />
          </div>

          {/* Status & Priority */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Badge className="bg-primary/10 text-primary border-primary/20">
              {humanizeEnum(data.client.status)}
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.04]">
              {humanizeEnum(data.client.priority)}
            </Badge>
            {data.client.assignedEmployee && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {data.client.assignedEmployee.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {data.client.assignedEmployee.name}
                </span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                asChild
                className="input-premium h-9 rounded-xl border-white/[0.07] bg-transparent gap-2"
              >
                <Link href={action.href}>
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {canManage && (
        <EditClientDialog
          client={editableClient}
          employees={employees ?? []}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Overview Cards */}
      <div className="container mx-auto max-w-[1680px] px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <MetricCard
            label="Open Tasks"
            value={metrics.totalOpenTasks || 0}
            icon={CheckSquare}
            color="text-blue-400"
          />
          <MetricCard
            label="Overdue Tasks"
            value={metrics.overdueTasks || 0}
            icon={AlertCircle}
            color="text-red-400"
          />
          <MetricCard
            label="Outstanding"
            value={`₹${(metrics.outstandingPayments || 0).toLocaleString()}`}
            icon={DollarSign}
            color="text-yellow-400"
          />
          <MetricCard
            label="Documents"
            value={metrics.documentsUploaded || 0}
            icon={Folder}
            color="text-purple-400"
          />
          <MetricCard
            label="Active Services"
            value={metrics.activeServices || 0}
            icon={Building2}
            color="text-green-400"
          />
          <MetricCard
            label="Compliance"
            value={metrics.upcomingCompliance || 0}
            icon={Calendar}
            color="text-orange-400"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl p-1 mb-6 w-fit">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-9 rounded-lg gap-2",
                activeTab === tab.id && "btn-glow"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <OverviewTab data={data} />
              </motion.div>
            )}
            {activeTab === "services" && (
              <motion.div
                key="services"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <ServicesTab services={data.services} />
              </motion.div>
            )}
            {activeTab === "tasks" && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <TasksTab tasks={data.tasks} />
              </motion.div>
            )}
            {activeTab === "payments" && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <PaymentsTab invoices={data.invoices} />
              </motion.div>
            )}
            {activeTab === "documents" && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <DocumentsTab
                  documents={data.documents}
                  checklist={data.documentChecklist ?? []}
                  clientId={data.client.id}
                />
              </motion.div>
            )}
            {activeTab === "compliance" && (
              <motion.div
                key="compliance"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <ClientComplianceTab
                  clientId={clientId}
                  complianceEvents={data.complianceEvents ?? []}
                  metrics={{
                    complianceScore: data.metrics?.complianceScore ?? 100,
                    overdueCompliance: data.metrics?.overdueCompliance ?? 0,
                    upcomingCompliance: data.metrics?.upcomingCompliance ?? 0,
                  }}
                  canManage={canManage}
                  currentUser={data.user}
                />
              </motion.div>
            )}
            {activeTab === "activity" && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <ActivityTab data={data} />
              </motion.div>
            )}

            {activeTab === "timeline" && (
              <motion.div
                key="timeline"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <ClientTimeline events={data.timelineEvents || []} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard hover={false} className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/[0.04]">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-1">{value}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
    >
      <GlassCard hover={false} className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </GlassCard>
    </motion.div>
  )
}

function OverviewTab({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <GlassCard hover={false} className="p-6">
        <h3 className="text-lg font-semibold mb-4">Client Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Client Name</p>
            <p className="font-medium">{data.client.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Client Code</p>
            <p className="font-medium">{data.client.clientCode}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Status</p>
            <Badge className="bg-primary/10 text-primary border-primary/20">{humanizeEnum(data.client.status)}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Priority</p>
            <Badge variant="outline" className="border-white/10 bg-white/[0.04]">{humanizeEnum(data.client.priority)}</Badge>
          </div>
        </div>
      </GlassCard>

      {data.documentCompleteness && (
        <GlassCard hover={false} className="p-6">
          <h3 className="text-lg font-semibold mb-4">Document Completeness</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completeness Score</span>
              <span className="text-xl font-bold">{data.documentCompleteness.score}%</span>
            </div>
            <div className="w-full bg-muted/30 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${data.documentCompleteness.score >= 80 ? "bg-emerald-500" : data.documentCompleteness.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${data.documentCompleteness.score}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Received</p>
                <p className="font-medium">{data.documentCompleteness.totalReceived} / {data.documentCompleteness.totalExpected}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expiring Soon</p>
                <p className="font-medium text-amber-400">{data.documentCompleteness.expiringSoon}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Expired</p>
                <p className="font-medium text-red-400">{data.documentCompleteness.expired}</p>
              </div>
            </div>
            {data.documentCompleteness.pendingCategories.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Pending Document Categories</p>
                <div className="flex gap-1.5 flex-wrap">
                  {data.documentCompleteness.pendingCategories.map((cat: string) => (
                    <Badge key={cat} variant="outline" className="text-[10px] border-amber-500/20 text-amber-400">
                      {cat.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      <GlassCard hover={false} className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Tasks</h3>
        <div className="space-y-4">
          {data.tasks.slice(0, 5).map((task: any) => (
            <div key={task.id} className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckSquare className="h-4 w-4 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{task.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(task.createdAt), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">{task.status}</Badge>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

function ServicesTab({ services }: { services: any[] }) {
  return (
    <GlassCard hover={false} className="p-6">
      <h3 className="text-lg font-semibold mb-4">Services</h3>
      {services.length === 0 ? (
        <p className="text-muted-foreground">No services assigned</p>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/[0.08]">
              <div>
                <p className="font-medium">{serviceLabel(service.serviceType, service.customName)}</p>
                <p className="text-sm text-muted-foreground mt-1">{service.status}</p>
              </div>
              <Badge variant="outline">{service.frequency}</Badge>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function TasksTab({ tasks }: { tasks: any[] }) {
  return (
    <GlassCard hover={false} className="p-6">
      <h3 className="text-lg font-semibold mb-4">Tasks</h3>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground">No tasks found</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/[0.08]">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CheckSquare className="h-4 w-4 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                {task.dueDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  task.isOverdue && "bg-red-500/10 text-red-400 border-red-500/20"
                )}
              >
                {task.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function PaymentsTab({ invoices }: { invoices: any[] }) {
  return (
    <GlassCard hover={false} className="p-6">
      <h3 className="text-lg font-semibold mb-4">Payments</h3>
      {invoices.length === 0 ? (
        <p className="text-muted-foreground">No invoices found</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/[0.08]">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-4 w-4 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground mt-1">₹{invoice.amount?.toLocaleString()}</p>
                {invoice.dueDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  invoice.status === "OVERDUE" && "bg-red-500/10 text-red-400 border-red-500/20"
                )}
              >
                {invoice.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function DocumentsTab({
  documents,
  checklist,
  clientId,
}: {
  documents: any[]
  checklist: any[]
  clientId: string
}) {
  return (
    <div className="space-y-6">
      <DocumentChecklistCard checklist={checklist} clientId={clientId} />
      <GlassCard hover={false} className="p-6">
        <h3 className="text-lg font-semibold mb-4">Uploaded documents</h3>
        {documents.length === 0 ? (
          <p className="text-muted-foreground">No documents found</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/[0.08]">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Folder className="h-4 w-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{doc.type}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Uploaded: {format(new Date(doc.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}

type ChecklistItem = {
  id: string
  label: string
  collected: boolean
  collectedAt: string | Date | null
}

function DocumentChecklistCard({
  checklist,
  clientId,
}: {
  checklist: ChecklistItem[]
  clientId: string
}) {
  // Local source of truth — the parent's data prop is frozen at mount
  // (useState(initialData)), so we refetch this list after each mutation.
  const [items, setItems] = useState<ChecklistItem[]>(checklist)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [pending, setPending] = useState(false)

  const collected = items.filter((c) => c.collected).length
  const total = items.length
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0

  async function refresh() {
    setItems((await getClientChecklist(clientId)) as ChecklistItem[])
  }

  async function toggle(item: ChecklistItem) {
    setBusyId(item.id)
    try {
      const res = await setDocumentCollected(item.id, !item.collected)
      if (res.error) toast.error(res.error)
      else await refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(item: ChecklistItem) {
    setBusyId(item.id)
    try {
      const res = await removeChecklistItem(item.id)
      if (res.error) toast.error(res.error)
      else {
        toast.success("Removed from checklist.")
        await refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  async function add() {
    if (!newLabel.trim()) return
    setPending(true)
    try {
      const res = await addChecklistItem(clientId, newLabel)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setNewLabel("")
      setAdding(false)
      await refresh()
    } finally {
      setPending(false)
    }
  }

  async function generate() {
    setPending(true)
    try {
      const res = await generateChecklistFromServices(clientId)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(res.added ? `Added ${res.added} document${res.added === 1 ? "" : "s"}.` : "Checklist is already up to date.")
      await refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <GlassCard hover={false} className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Document checklist</h3>
        </div>
        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            {collected} of {total} collected
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No document checklist yet. Generate one from this client&apos;s services.
          </p>
          <Button size="sm" className="btn-glow gap-1.5 rounded-xl" disabled={pending} onClick={() => void generate()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate from services
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group flex items-center gap-3 rounded-lg border p-3 transition-colors",
                item.collected
                  ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                  : "border-white/[0.08] bg-white/[0.02]"
              )}
            >
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void toggle(item)}
                aria-pressed={item.collected}
                aria-label={item.collected ? `Mark ${item.label} as not collected` : `Mark ${item.label} as collected`}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  item.collected
                    ? "border-emerald-500/40 bg-emerald-500 text-white"
                    : "border-white/[0.2] bg-white/[0.03] hover:border-primary/50"
                )}
              >
                {busyId === item.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : item.collected ? (
                  <Check className="size-3.5" />
                ) : null}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", item.collected && "text-emerald-100")}>{item.label}</p>
                {item.collected && item.collectedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Collected {format(new Date(item.collectedAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => void remove(item)}
                aria-label={`Remove ${item.label}`}
                className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add a custom document */}
      <div className="mt-4">
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add()
                if (e.key === "Escape") { setAdding(false); setNewLabel("") }
              }}
              placeholder="e.g. Board resolution, Rent agreement"
              maxLength={200}
              className="input-premium h-9 flex-1 rounded-lg bg-transparent px-3 text-sm"
            />
            <Button size="sm" className="btn-glow rounded-lg" disabled={pending || !newLabel.trim()} onClick={() => void add()}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => { setAdding(false); setNewLabel("") }}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" /> Add a document
          </button>
        )}
      </div>
    </GlassCard>
  )
}

function ActivityTab({ data }: { data: any }) {
  return (
    <GlassCard hover={false} className="p-6">
      <h3 className="text-lg font-semibold mb-4">Tasks</h3>
      <div className="space-y-4">
        {data.tasks.slice(0, 10).map((task: any) => (
          <div key={task.id} className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            <div className="flex-1">
              <p className="text-sm font-medium">Task created: {task.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(task.createdAt), "MMM d, yyyy h:mm a")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
