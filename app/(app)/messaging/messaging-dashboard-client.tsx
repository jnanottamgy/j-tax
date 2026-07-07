"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Mail, Send, FileText, Clock,
  CheckCircle2, XCircle, RefreshCw, Plus, Loader2,
  Pencil, Trash2, BellRing, MessageCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { GlassCard } from "@/components/dashboard/glass-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { TemplateBuilder } from "@/components/messaging/template-builder"
import { MessageLogs } from "@/components/messaging/message-logs"
import {
  getMessages,
  getMessageTemplates,
  getChannelStatus,
  createMessage,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendBulkReminders,
} from "@/app/actions/messages"
import type { MessageChannel } from "@/app/actions/messages"
import { toast } from "sonner"
import { FormAlert } from "@/components/forms/form-alert"
import { FormField } from "@/components/forms/form-field"
import { useValidatedForm } from "@/hooks/use-validated-form"
import { messageSchema } from "@/lib/validations/message"
import { cn } from "@/lib/utils"

type ViewMode = "dashboard" | "templates" | "logs" | "send" | "bulk"

export function MessagingDashboardClient() {
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    searchParams.get("compose") === "1" ? "send" : "dashboard"
  )
  const [messages, setMessages] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<any | null>(null)

  // Send form state — deep links (?compose=1&clientId=...&channel=whatsapp)
  // pre-select the client and channel
  const [sendClientId, setSendClientId] = useState(() => searchParams.get("clientId") ?? "")
  const [sendContent, setSendContent] = useState("")
  const [sendTemplateId, setSendTemplateId] = useState("")
  const [sendChannel, setSendChannel] = useState<MessageChannel>(() =>
    searchParams.get("channel")?.toLowerCase() === "whatsapp" ? "WHATSAPP" : "EMAIL"
  )

  // Bulk reminders state
  const [bulkTemplateId, setBulkTemplateId] = useState("")
  const [bulkClientIds, setBulkClientIds] = useState<Set<string>>(new Set())
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkChannel, setBulkChannel] = useState<MessageChannel>("EMAIL")

  // Channel availability (WhatsApp needs API credentials)
  const [whatsappConfigured, setWhatsappConfigured] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [messagesData, templatesData, channelStatus] = await Promise.all([
        getMessages(),
        getMessageTemplates(),
        getChannelStatus(),
      ])
      setMessages(messagesData.messages)
      setTemplates(templatesData.templates)
      setClients(messagesData.clients)
      setUser(messagesData.user)
      setWhatsappConfigured(channelStatus.whatsappConfigured)
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

  const handleSaveTemplate = async (template: {
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
    if (editingTemplate) formData.append("id", editingTemplate.id)
    const result = editingTemplate
      ? await updateTemplate({}, formData)
      : await createTemplate({}, formData)
    if (result.success) {
      await loadData()
    }
    return result
  }

  const handleDeleteTemplateConfirmed = async () => {
    if (!deletingTemplate) return
    const result = await deleteTemplate(deletingTemplate.id)
    if (result.success) {
      toast.success(`Template "${deletingTemplate.name}" deleted`)
      await loadData()
    } else {
      toast.error(result.error ?? "Failed to delete template")
    }
  }

  const sendForm = useValidatedForm({
    schema: messageSchema,
    successMessage: "Message sent successfully",
    onSuccess: () => {
      setSendClientId("")
      setSendContent("")
      setSendTemplateId("")
      setViewMode("dashboard")
      void loadData()
    },
    onSubmit: async (data) => {
      const formData = new FormData()
      formData.append("clientId", data.clientId)
      formData.append("content", data.content)
      formData.append("channel", data.channel)
      if (data.templateId) formData.append("templateId", data.templateId)
      return createMessage({}, formData)
    },
  })

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    sendForm.submit({
      clientId: sendClientId,
      content: sendContent,
      templateId: sendTemplateId,
      channel: sendChannel,
    })
  }

  // When a template is selected, pre-fill the content
  const handleTemplateSelect = (templateId: string) => {
    setSendTemplateId(templateId)
    const tpl = templates.find((t) => t.id === templateId)
    if (tpl) setSendContent(tpl.content)
  }

  const handleBulkSend = async () => {
    if (!bulkTemplateId) {
      toast.error("Choose a template first.")
      return
    }
    if (bulkClientIds.size === 0) {
      toast.error("Select at least one client.")
      return
    }
    setBulkSending(true)
    try {
      const result = await sendBulkReminders(Array.from(bulkClientIds), bulkTemplateId, bulkChannel)
      if (result.success) {
        toast.success(result.message ?? `${result.count ?? 0} reminders sent`)
        if (result.error) toast.warning(result.error)
        setBulkClientIds(new Set())
        setBulkTemplateId("")
        setViewMode("dashboard")
        void loadData()
      } else {
        toast.error(result.error ?? "Failed to send reminders")
      }
    } finally {
      setBulkSending(false)
    }
  }

  const toggleBulkClient = (id: string) => {
    setBulkClientIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canModify = user?.role === "PARTNER" || user?.role === "MANAGER"

  const selectedClient = clients.find((c) => c.id === sendClientId)
  const emailClients = clients.filter((c) => c.email)
  const waClients = clients.filter((c) => c.whatsapp || c.phone)
  const bulkEligibleClients = bulkChannel === "WHATSAPP" ? waClients : emailClients

  const clientHasRecipient = (c: any, channel: MessageChannel) =>
    channel === "WHATSAPP" ? Boolean(c.whatsapp || c.phone) : Boolean(c.email)

  const switchBulkChannel = (channel: MessageChannel) => {
    setBulkChannel(channel)
    // Prune selections that have no recipient on the new channel
    setBulkClientIds((prev) => {
      const eligible = new Set(
        (channel === "WHATSAPP" ? waClients : emailClients).map((c) => c.id)
      )
      return new Set(Array.from(prev).filter((id) => eligible.has(id)))
    })
  }

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
          { label: "Total Messages", value: stats.total, icon: Mail, color: "" },
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
            {mode === "dashboard" && <Mail className="h-4 w-4" />}
            {mode === "templates" && <FileText className="h-4 w-4" />}
            {mode === "logs" && <Clock className="h-4 w-4" />}
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Button>
        ))}
        <div className="flex-1" />
        {canModify && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-xl"
              onClick={() => setViewMode("bulk")}
            >
              <BellRing className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bulk Reminders</span>
            </Button>
            <Button
              size="sm"
              className="btn-glow h-8 gap-1.5 rounded-xl"
              onClick={() => setViewMode("send")}
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Send Message</span>
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      {showTemplateBuilder || editingTemplate ? (
        <TemplateBuilder
          onSave={handleSaveTemplate}
          onCancel={() => {
            setShowTemplateBuilder(false)
            setEditingTemplate(null)
          }}
          initialData={
            editingTemplate
              ? {
                  name: editingTemplate.name,
                  type: editingTemplate.type,
                  content: editingTemplate.content,
                  variables: Array.isArray(editingTemplate.variables)
                    ? editingTemplate.variables
                    : [],
                }
              : undefined
          }
        />
      ) : viewMode === "send" ? (
        /* ── Send Message Form ── */
        <GlassCard hover={false} className="p-6 max-w-lg">
          <h3 className="text-lg font-semibold mb-4">Send Message</h3>
          <form onSubmit={handleSendMessage} className="space-y-4" noValidate>
            {sendForm.formError && <FormAlert message={sendForm.formError} />}

            {/* Channel picker */}
            <div className="space-y-2">
              <Label>Channel</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={sendChannel === "EMAIL" ? "default" : "outline"}
                  className={cn("h-10 gap-2 rounded-xl", sendChannel === "EMAIL" && "btn-glow")}
                  onClick={() => setSendChannel("EMAIL")}
                  disabled={sendForm.isPending}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={sendChannel === "WHATSAPP" ? "default" : "outline"}
                  className={cn("h-10 gap-2 rounded-xl", sendChannel === "WHATSAPP" && "btn-glow")}
                  onClick={() => setSendChannel("WHATSAPP")}
                  disabled={sendForm.isPending || !whatsappConfigured}
                  title={whatsappConfigured ? undefined : "WhatsApp Business API is not configured yet"}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </div>
              {!whatsappConfigured && (
                <p className="text-xs text-muted-foreground">
                  WhatsApp needs API credentials — add{" "}
                  <code className="text-[11px]">WHATSAPP_API_TOKEN</code> and{" "}
                  <code className="text-[11px]">WHATSAPP_PHONE_NUMBER_ID</code> to enable it.
                </p>
              )}
              {sendChannel === "WHATSAPP" && whatsappConfigured && (
                <p className="text-xs text-amber-400/90">
                  Free-form WhatsApp texts only deliver within 24h of the client&apos;s
                  last message to you. Outside that window Meta requires a
                  pre-approved template.
                </p>
              )}
            </div>

            <FormField label="Client" htmlFor="send-client" required error={sendForm.getError("clientId")}>
              <select
                id="send-client"
                value={sendClientId}
                onChange={(e) => setSendClientId(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
                disabled={sendForm.isPending}
                aria-invalid={!!sendForm.getError("clientId")}
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id} disabled={!clientHasRecipient(c, sendChannel)}>
                    {c.name}
                    {clientHasRecipient(c, sendChannel)
                      ? ""
                      : sendChannel === "WHATSAPP"
                        ? " (no WhatsApp/phone on file)"
                        : " (no email on file)"}
                  </option>
                ))}
              </select>
              {selectedClient && clientHasRecipient(selectedClient, sendChannel) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {sendChannel === "WHATSAPP" ? (
                    <>Will be sent on WhatsApp to <strong>{selectedClient.whatsapp || selectedClient.phone}</strong></>
                  ) : (
                    <>Will be emailed to <strong>{selectedClient.email}</strong></>
                  )}
                </p>
              )}
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
                disabled={sendForm.isPending}
              >
                {sendForm.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />{sendChannel === "WHATSAPP" ? "Send WhatsApp" : "Send Email"}</>
                )}
              </Button>
            </div>
          </form>
        </GlassCard>
      ) : viewMode === "bulk" ? (
        /* ── Bulk Reminders ── */
        <GlassCard hover={false} className="p-6 max-w-2xl">
          <h3 className="text-lg font-semibold mb-1">Bulk Reminders</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Send a template to several clients at once. Clients without a usable{" "}
            {bulkChannel === "WHATSAPP" ? "WhatsApp number" : "email address"} are skipped.
          </p>

          {templates.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No templates yet"
              description="Create a template first — bulk reminders send a template to many clients."
              action={{ label: "Create Template", onClick: () => setShowTemplateBuilder(true) }}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Channel</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={bulkChannel === "EMAIL" ? "default" : "outline"}
                    className={cn("h-10 gap-2 rounded-xl", bulkChannel === "EMAIL" && "btn-glow")}
                    onClick={() => switchBulkChannel("EMAIL")}
                    disabled={bulkSending}
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={bulkChannel === "WHATSAPP" ? "default" : "outline"}
                    className={cn("h-10 gap-2 rounded-xl", bulkChannel === "WHATSAPP" && "btn-glow")}
                    onClick={() => switchBulkChannel("WHATSAPP")}
                    disabled={bulkSending || !whatsappConfigured}
                    title={whatsappConfigured ? undefined : "WhatsApp Business API is not configured yet"}
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </div>
                {!whatsappConfigured && (
                  <p className="text-xs text-muted-foreground">
                    WhatsApp needs API credentials — add{" "}
                    <code className="text-[11px]">WHATSAPP_API_TOKEN</code> and{" "}
                    <code className="text-[11px]">WHATSAPP_PHONE_NUMBER_ID</code> to enable it.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-template">Template</Label>
                <select
                  id="bulk-template"
                  value={bulkTemplateId}
                  onChange={(e) => setBulkTemplateId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-white/[0.12] bg-background px-3 text-sm"
                  disabled={bulkSending}
                >
                  <option value="">Select a template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Clients ({bulkClientIds.size} selected)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={bulkSending}
                      onClick={() => setBulkClientIds(new Set(bulkEligibleClients.map((c) => c.id)))}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={bulkSending}
                      onClick={() => setBulkClientIds(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-white/[0.08] p-2 space-y-1">
                  {bulkEligibleClients.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      {bulkChannel === "WHATSAPP"
                        ? "No clients with a WhatsApp/phone number on file yet."
                        : "No clients with an email address on file yet."}
                    </p>
                  ) : (
                    bulkEligibleClients.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          checked={bulkClientIds.has(c.id)}
                          onChange={() => toggleBulkClient(c.id)}
                          disabled={bulkSending}
                          className="size-4 rounded border-white/20 accent-primary"
                        />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {bulkChannel === "WHATSAPP" ? c.whatsapp || c.phone : c.email}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setViewMode("dashboard")}
                  disabled={bulkSending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 btn-glow"
                  onClick={handleBulkSend}
                  disabled={bulkSending}
                >
                  {bulkSending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
                  ) : (
                    <><BellRing className="h-4 w-4 mr-2" />Send to {bulkClientIds.size || "..."} client{bulkClientIds.size === 1 ? "" : "s"}</>
                  )}
                </Button>
              </div>
            </div>
          )}
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
                icon={Mail}
                title="No messages sent yet"
                description="Send branded emails and WhatsApp messages to your clients"
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
                        {message.metadata?.provider === "WHATSAPP" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/20 gap-1">
                            <Mail className="h-3 w-3" />
                            Email
                          </Badge>
                        )}
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
                description="Create reusable email templates for faster communication"
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
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium truncate">{template.name}</h4>
                      <Badge variant="outline" className="shrink-0 text-xs">{template.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{template.content}</p>
                    {canModify && (
                      <div className="flex justify-end gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditingTemplate(template)}
                          aria-label={`Edit template ${template.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingTemplate(template)}
                          aria-label={`Delete template ${template.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
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

      <ConfirmDialog
        open={deletingTemplate !== null}
        onOpenChange={(open) => !open && setDeletingTemplate(null)}
        title={`Delete template "${deletingTemplate?.name ?? ""}"?`}
        description="Messages already sent with this template keep their history; the template itself is permanently removed."
        confirmLabel="Delete template"
        destructive
        onConfirm={handleDeleteTemplateConfirmed}
      />
    </div>
  )
}
