"use client"

import { useCallback, useEffect, useState } from "react"
import {
  MessageSquare, Send, FileText, Clock,
  CheckCircle2, XCircle, RefreshCw, Plus, Loader2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { GlassCard } from "@/components/dashboard/glass-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { TemplateBuilder } from "@/components/messaging/template-builder"
import { MessageLogs } from "@/components/messaging/message-logs"
import {
  getMessages,
  getMessageTemplates,
  createMessage,
  createTemplate,
} from "@/app/actions/messages"
import { toast } from "sonner"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { messageSchema } from "@/lib/validations/message"
import { cn } from "@/lib/utils"

type ViewMode = "dashboard" | "templates" | "logs" | "send"

export function MessagingDashboardClient() {
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard")
  const [messages, setMessages] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false)

  // Send message form state
  const [sendClientId, setSendClientId] = useState("")
  const [sendPhone, setSendPhone] = useState("")
  const [sendContent, setSendContent] = useState("")
  const [sendTemplateId, setSendTemplateId] = useState("")

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [messagesData, templatesData] = await Promise.all([
        getMessages(),
        getMessageTemplates(),
      ])
      setMessages(messagesData.messages)
      setTemplates(templatesData.templates)
      setClients(messagesData.clients)
      setUser(messagesData.user)
    } catch (error) {
      console.error("Failed to load messaging data:", error)
      toast.error("Failed to load messaging data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateTemplate = async (template: {
    name: string
    type: string
    content: string
    variables: string[]
  }) => {
    const formData = new FormData()
    formData.append("name", template.name)
    formData.append("type", template.type)
    formData.append("content", template.content)
    formData.append("variables", JSON.stringify(template.variables))
    const result = await createTemplate({}, formData)
    if (result.success) {
      await loadData()
    }
    return result
  }

  const sendForm = useValidatedForm({
    schema: messageSchema,
    successMessage: "Message sent successfully",
    onSuccess: () => {
      setSendClientId("")
      setSendPhone("")
      setSendContent("")
      setSendTemplateId("")
      setViewMode("dashboard")
      void loadData()
    },
    onSubmit: async (data) => {
      const formData = new FormData()
      formData.append("clientId", data.clientId)
      formData.append("phoneNumber", data.phoneNumber)
      formData.append("content", data.content)
      if (data.templateId) formData.append("templateId", data.templateId)
      return createMessage({}, formData)
    },
  })

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    sendForm.submit({
      clientId: sendClientId,
      phoneNumber: sendPhone,
      content: sendContent,
      templateId: sendTemplateId,
    })
  }

  // When a template is selected, pre-fill the content
  const handleTemplateSelect = (templateId: string) => {
    setSendTemplateId(templateId)
    const tpl = templates.find((t) => t.id === templateId)
    if (tpl) setSendContent(tpl.content)
  }

  const canModify = user?.role === "PARTNER" || user?.role === "MANAGER"

  const stats = {
    total: messages.length,
    sent: messages.filter((m) => ["SENT", "DELIVERED", "READ"].includes(m.status)).length,
    pending: messages.filter((m) => ["PENDING", "QUEUED"].includes(m.status)).length,
    failed: messages.filter((m) => m.status === "FAILED").length,
  }

  // Collect all message logs across all messages for the Logs tab
  const allLogs = messages.flatMap((m) =>
    (m.logs ?? []).map((log: any) => ({ ...log, message: m }))
  ).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="h-96">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Messages", value: stats.total, icon: MessageSquare, color: "" },
          { label: "Sent/Delivered", value: stats.sent, icon: CheckCircle2, color: "text-green-400" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-400" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <GlassCard key={label} hover={false} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={cn("text-2xl font-semibold mt-1", color)}>{value}</p>
              </div>
              <Icon className={cn("h-8 w-8 opacity-50", color)} />
            </div>
          </GlassCard>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.08] rounded-xl p-1">
        {(["dashboard", "templates", "logs"] as ViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode(mode)}
            className={cn("h-8 rounded-lg gap-2 capitalize", viewMode === mode && "btn-glow")}
          >
            {mode === "dashboard" && <MessageSquare className="h-4 w-4" />}
            {mode === "templates" && <FileText className="h-4 w-4" />}
            {mode === "logs" && <Clock className="h-4 w-4" />}
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Button>
        ))}
        <div className="flex-1" />
        {canModify && (
          <Button
            size="sm"
            className="btn-glow h-8 gap-1.5 rounded-xl"
            onClick={() => setViewMode("send")}
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Send Message</span>
          </Button>
        )}
      </div>

      {/* Content */}
      {showTemplateBuilder ? (
        <TemplateBuilder
          onSave={handleCreateTemplate}
          onCancel={() => setShowTemplateBuilder(false)}
        />
      ) : viewMode === "send" ? (
        /* ── Send Message Form ── */
        <GlassCard hover={false} className="p-6 max-w-lg">
          <h3 className="text-lg font-semibold mb-4">Send WhatsApp Message</h3>
          <form onSubmit={handleSendMessage} className="space-y-4" noValidate>
            {sendForm.formError && <FormAlert message={sendForm.formError} />}
            <FormField label="Client" htmlFor="send-client" required error={sendForm.getError("clientId")}>
              <select
                id="send-client"
                value={sendClientId}
                onChange={(e) => {
                  setSendClientId(e.target.value)
                  const client = clients.find((c) => c.id === e.target.value)
                  if (client?.phoneNumber) setSendPhone(client.phoneNumber)
                  else if (client?.phone) setSendPhone(client.phone)
                }}
                className="h-10 w-full rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
                disabled={sendForm.isPending}
                aria-invalid={!!sendForm.getError("clientId")}
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Phone Number" htmlFor="send-phone" required error={sendForm.getError("phoneNumber")}>
              <Input
                id="send-phone"
                value={sendPhone}
                onChange={(e) => setSendPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="h-10 rounded-xl"
                disabled={sendForm.isPending}
                aria-invalid={!!sendForm.getError("phoneNumber")}
              />
            </FormField>

            {templates.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="send-template">Use Template (optional)</Label>
                <select
                  id="send-template"
                  value={sendTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
                >
                  <option value="">No template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <FormField label="Message" htmlFor="send-content" required error={sendForm.getError("content")}>
              <Textarea
                id="send-content"
                value={sendContent}
                onChange={(e) => setSendContent(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="rounded-xl"
                disabled={sendForm.isPending}
                aria-invalid={!!sendForm.getError("content")}
              />
            </FormField>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setViewMode("dashboard")}
                disabled={sendForm.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 btn-glow"
                disabled={
                  sendForm.isPending ||
                  !sendClientId ||
                  !sendPhone.trim() ||
                  !sendContent.trim()
                }
              >
                {sendForm.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Send Message</>
                )}
              </Button>
            </div>
          </form>
        </GlassCard>
      ) : viewMode === "dashboard" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent Messages</h3>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />Refresh
            </Button>
          </div>
          {messages.length === 0 ? (
            <GlassCard hover={false} className="p-12">
              <EmptyState
                icon={MessageSquare}
                title="No messages sent yet"
                description="Start communicating with your clients via WhatsApp"
                action={canModify ? {
                  label: "Send Message",
                  onClick: () => setViewMode("send"),
                } : undefined}
              />
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {messages.slice(0, 10).map((message) => (
                <Card key={message.id} className="bg-white/[0.02] border-white/[0.08] p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{message.client?.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            ["SENT", "DELIVERED", "READ"].includes(message.status)
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : message.status === "FAILED"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          )}
                        >
                          {message.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{message.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(message.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "templates" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Message Templates</h3>
            {canModify && (
              <Button size="sm" className="btn-glow" onClick={() => setShowTemplateBuilder(true)}>
                <Plus className="h-4 w-4 mr-2" />New Template
              </Button>
            )}
          </div>
          {templates.length === 0 ? (
            <GlassCard hover={false} className="p-12">
              <EmptyState
                icon={FileText}
                title="No templates created yet"
                description="Create reusable message templates for faster communication"
                action={canModify ? {
                  label: "Create Template",
                  onClick: () => setShowTemplateBuilder(true),
                } : undefined}
              />
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="bg-white/[0.02] border-white/[0.08] p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{template.name}</h4>
                      <Badge variant="outline" className="text-xs">{template.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{template.content}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "logs" ? (
        /* ── Logs tab: pass real data ── */
        <MessageLogs logs={allLogs} />
      ) : null}
    </div>
  )
}
