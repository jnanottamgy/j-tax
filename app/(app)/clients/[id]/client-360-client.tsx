"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Plus,
  FileText,
  CheckSquare,
  DollarSign,
  Folder,
  Calendar,
  Activity,
  MoreVertical,
  Phone,
  Mail,
  User,
  Building2,
  AlertCircle,
  Clock,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlassCard } from "@/components/dashboard/glass-card"
import { ClientComplianceTab } from "@/components/compliance/client-compliance-tab"
import { cn } from "@/lib/utils"

type TabType = "overview" | "services" | "tasks" | "payments" | "documents" | "compliance" | "activity"

interface Client360ClientProps {
  initialData: any
  clientId: string
}

export function Client360Client({ initialData, clientId }: Client360ClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  const canManage = data.user.role === "PARTNER" || data.user.role === "MANAGER"

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: Activity },
    { id: "services" as TabType, label: "Services", icon: Building2 },
    { id: "tasks" as TabType, label: "Tasks", icon: CheckSquare },
    { id: "payments" as TabType, label: "Payments", icon: DollarSign },
    { id: "documents" as TabType, label: "Documents", icon: Folder },
    { id: "compliance" as TabType, label: "Compliance", icon: Calendar },
    { id: "activity" as TabType, label: "Activity", icon: Activity },
  ]

  const quickActions = [
    { label: "Add Task", icon: CheckSquare, href: `/work-tracker?clientId=${clientId}` },
    { label: "Add Invoice", icon: DollarSign, href: `/invoices/new?clientId=${clientId}` },
    { label: "Upload Document", icon: Folder, href: `/documents/new?clientId=${clientId}` },
    { label: "Send Reminder", icon: Phone, href: `/messaging?clientId=${clientId}` },
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
                    <DropdownMenuItem>Edit Client</DropdownMenuItem>
                    <DropdownMenuItem>Assign Employee</DropdownMenuItem>
                    <DropdownMenuItem>Update Status</DropdownMenuItem>
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
              {data.client.status}
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.04]">
              {data.client.priority}
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
                <DocumentsTab documents={data.documents} />
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
          <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
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
            <Badge className="bg-primary/10 text-primary border-primary/20">{data.client.status}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Priority</p>
            <Badge variant="outline" className="border-white/10 bg-white/[0.04]">{data.client.priority}</Badge>
          </div>
        </div>
      </GlassCard>

      <GlassCard hover={false} className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
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
                <p className="font-medium">{service.serviceType}</p>
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

function DocumentsTab({ documents }: { documents: any[] }) {
  return (
    <GlassCard hover={false} className="p-6">
      <h3 className="text-lg font-semibold mb-4">Documents</h3>
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
  )
}

function ActivityTab({ data }: { data: any }) {
  return (
    <GlassCard hover={false} className="p-6">
      <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
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
