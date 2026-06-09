"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Send, Search, MoreVertical, Phone, Video, Paperclip, Smile, Check, CheckCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  content: string
  sent: boolean
  timestamp: Date
  status: "sent" | "delivered" | "read" | "failed"
}

interface Client {
  id: string
  name: string
  avatar?: string
  lastMessage?: string
  lastMessageTime?: Date
  unreadCount?: number
  phoneNumber?: string
}

interface WhatsAppChatProps {
  clients: Client[]
  onSendMessage?: (clientId: string, message: string) => Promise<void>
  onClientSelect?: (clientId: string) => void
  currentUser?: { id: string; name: string }
}

export function WhatsAppChat({ clients, onSendMessage, onClientSelect, currentUser }: WhatsAppChatProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (_clientId: string) => {
    // TODO: Load actual messages from server
    // For now, we'll use mock data
    setMessages([
      {
        id: "1",
        content: "Hello! This is a test message.",
        sent: false,
        timestamp: new Date(Date.now() - 3600000),
        status: "read",
      },
      {
        id: "2",
        content: "Hi there! How can I help you today?",
        sent: true,
        timestamp: new Date(Date.now() - 3000000),
        status: "read",
      },
    ])
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (selectedClient) {
      // Load messages for selected client
      loadMessages(selectedClient.id)
    }
  }, [selectedClient, loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedClient || isSending) return

    setIsSending(true)
    try {
      const newMessage: Message = {
        id: Date.now().toString(),
        content: inputMessage,
        sent: true,
        timestamp: new Date(),
        status: "sent",
      }

      setMessages((prev) => [...prev, newMessage])
      setInputMessage("")

      await onSendMessage?.(selectedClient.id, inputMessage)

      // Update message status to delivered after a delay
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessage.id ? { ...msg, status: "delivered" as const } : msg
          )
        )
      }, 1000)

      // Update message status to read after another delay
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessage.id ? { ...msg, status: "read" as const } : msg
          )
        )
      }, 2000)
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsSending(false)
    }
  }

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-400" />
      case "failed":
        return <div className="h-3 w-3 rounded-full bg-red-400" />
      default:
        return null
    }
  }

  return (
    <div className="flex h-[calc(100vh-200px)] bg-background border border-white/[0.08] rounded-2xl overflow-hidden">
      {/* Sidebar - Client List */}
      <div className="w-80 border-r border-white/[0.08] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Messages</h2>
            <Button variant="ghost" size="icon-sm" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 input-premium rounded-xl"
            />
          </div>
        </div>

        {/* Client List */}
        <div className="flex-1 overflow-y-auto">
          {filteredClients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No clients found
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                onClick={() => {
                  setSelectedClient(client)
                  onClientSelect?.(client.id)
                }}
                className={cn(
                  "flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors",
                  selectedClient?.id === client.id && "bg-white/[0.04]"
                )}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={client.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate">{client.name}</span>
                    {client.lastMessageTime && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(client.lastMessageTime), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate">
                      {client.lastMessage || "No messages yet"}
                    </p>
                    {client.unreadCount && client.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {client.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedClient ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedClient.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedClient.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">{selectedClient.name}</h3>
                {selectedClient.phoneNumber && (
                  <p className="text-xs text-muted-foreground">{selectedClient.phoneNumber}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                <Video className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/[0.01]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2 max-w-[70%]",
                  message.sent ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                {!message.sent && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selectedClient.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2",
                    message.sent
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-white/[0.08] rounded-tl-sm"
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-1",
                      message.sent ? "justify-end" : "justify-start"
                    )}
                  >
                    <span className="text-xs opacity-70">
                      {format(new Date(message.timestamp), "HH:mm")}
                    </span>
                    {message.sent && getStatusIcon(message.status)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" className="h-9 w-9">
                <Paperclip className="h-4 w-4" />
              </Button>
              <div className="flex-1 relative">
                <Input
                  placeholder="Type a message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={isSending}
                  className="input-premium rounded-full h-10"
                />
              </div>
              <Button variant="ghost" size="icon-sm" className="h-9 w-9">
                <Smile className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isSending}
                className="h-9 w-9 btn-glow rounded-full"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white/[0.01]">
          <div className="text-center text-muted-foreground">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-white/[0.04] flex items-center justify-center">
              <Send className="h-8 w-8" />
            </div>
            <p className="font-medium">Select a client to start messaging</p>
            <p className="text-sm mt-1">Choose from the list on the left</p>
          </div>
        </div>
      )}
    </div>
  )
}
