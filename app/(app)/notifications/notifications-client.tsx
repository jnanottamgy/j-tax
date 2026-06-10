"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Check,
  CheckCheck,
  Archive,
  Trash2,
  Filter,
  Search,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  archiveAllNotifications,
  deleteNotification,
  markNotificationRead,
  type NotificationDTO,
} from "@/app/actions/notifications"
import { useNotifications } from "@/components/notifications/notifications-provider"

type TabType = "all" | "unread" | "archived"
type NotificationTypeFilter = "all" | "TASK_ASSIGNED" | "TASK_OVERDUE" | "COMPLIANCE_DUE" | "PAYMENT_RECEIVED" | "INVOICE_OVERDUE" | "DOCUMENT_UPLOADED"

function getNotificationIcon(type: string) {
  switch (type) {
    case "TASK_ASSIGNED":
      return <FileText className="size-4" />
    case "TASK_OVERDUE":
      return <AlertCircle className="size-4" />
    case "COMPLIANCE_DUE":
      return <Calendar className="size-4" />
    case "PAYMENT_RECEIVED":
      return <DollarSign className="size-4" />
    case "INVOICE_OVERDUE":
      return <AlertCircle className="size-4" />
    case "DOCUMENT_UPLOADED":
      return <FileText className="size-4" />
    case "WARNING":
      return <AlertCircle className="size-4" />
    case "ALERT":
      return <AlertCircle className="size-4" />
    default:
      return <Bell className="size-4" />
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case "TASK_ASSIGNED":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    case "TASK_OVERDUE":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20"
    case "COMPLIANCE_DUE":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20"
    case "PAYMENT_RECEIVED":
      return "bg-green-500/10 text-green-500 border-green-500/20"
    case "INVOICE_OVERDUE":
      return "bg-red-500/10 text-red-500 border-red-500/20"
    case "DOCUMENT_UPLOADED":
      return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20"
    case "WARNING":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    case "ALERT":
      return "bg-red-500/10 text-red-500 border-red-500/20"
    default:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20"
  }
}

function getNotificationLabel(type: string) {
  return type.replace(/_/g, " ").toLowerCase()
}

type NotificationsClientProps = {
  initialNotifications: NotificationDTO[]
}

export function NotificationsClient({
  initialNotifications: _initialNotifications,
}: NotificationsClientProps) {
  const router = useRouter()
  const {
    notifications,
    archived,
    unreadCount,
    markRead: _markRead,
    markAllRead,
    archive,
    unarchive,
  } = useNotifications()

  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Combine notifications and archived for display
  const allNotifications = useMemo(() => {
    if (activeTab === "archived") {
      return archived
    }
    return notifications
  }, [activeTab, notifications, archived])

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((n) => {
      // Tab filter
      if (activeTab === "unread" && n.read) return false

      // Type filter
      if (typeFilter !== "all" && n.type !== typeFilter) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query) ||
          n.type.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [allNotifications, activeTab, typeFilter, searchQuery])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
  }

  const handleMarkAllRead = async () => {
    await markAllRead()
  }

  const handleArchive = async (id: string) => {
    await archive(id)
  }

  const handleUnarchive = async (id: string) => {
    await unarchive(id)
  }

  const handleDelete = async (id: string) => {
    await deleteNotification(id)
  }

  const handleArchiveAll = async () => {
    await archiveAllNotifications()
  }

  const notificationTypes: { value: NotificationTypeFilter; label: string }[] = [
    { value: "all", label: "All Types" },
    { value: "TASK_ASSIGNED", label: "Task Assigned" },
    { value: "TASK_OVERDUE", label: "Task Overdue" },
    { value: "COMPLIANCE_DUE", label: "Compliance Due" },
    { value: "PAYMENT_RECEIVED", label: "Payment Received" },
    { value: "INVOICE_OVERDUE", label: "Invoice Overdue" },
    { value: "DOCUMENT_UPLOADED", label: "Document Uploaded" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compliance reminders, payment alerts, and task updates in one place.
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="secondary" className="w-fit">
            {unreadCount} unread
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === "all"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("all")}
        >
          All
          {activeTab === "all" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === "unread"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("unread")}
        >
          Unread
          {unreadCount > 0 && (
            <span className="ml-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
          {activeTab === "unread" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors relative",
            activeTab === "archived"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("archived")}
        >
          Archived
          {activeTab === "archived" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-premium h-9 rounded-xl pl-9 text-sm"
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Button
          variant={isFilterOpen ? "secondary" : "outline"}
          size="sm"
          className={cn(
            "h-9 rounded-xl",
            isFilterOpen && "bg-white/[0.08] border-primary/30"
          )}
          onClick={() => setIsFilterOpen(!isFilterOpen)}
        >
          <Filter className="size-3.5 mr-1.5" />
          Filter
        </Button>

        {activeTab !== "archived" && unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="size-3.5 mr-1.5" />
            Mark all read
          </Button>
        )}

        {activeTab === "all" && notifications.some((n) => n.read) && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl text-muted-foreground"
            onClick={handleArchiveAll}
          >
            <Archive className="size-3.5 mr-1.5" />
            Archive read
          </Button>
        )}
      </div>

      {/* Type Filter Chips */}
      {isFilterOpen && (
        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
          {notificationTypes.map((type) => (
            <button
              key={type.value}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg border transition-colors",
                typeFilter === type.value
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-white/[0.08] text-muted-foreground hover:border-white/[0.15]"
              )}
              onClick={() => setTypeFilter(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="mb-4 size-12 text-muted-foreground/40" />
            <p className="font-medium">
              {searchQuery
                ? "No matching notifications"
                : activeTab === "unread"
                ? "All caught up!"
                : activeTab === "archived"
                ? "No archived notifications"
                : "No notifications yet"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search or filters"
                : activeTab === "unread"
                ? "You have no unread notifications"
                : activeTab === "archived"
                ? "Archived notifications will appear here"
                : "When compliance deadlines, payments, or tasks need attention, they will appear here."}
            </p>
            {!searchQuery && activeTab !== "archived" && (
              <Button
                variant="outline"
                className="mt-6 input-premium rounded-xl"
                onClick={() => router.push("/")}
              >
                Back to dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                "border-white/[0.08] bg-white/[0.02] transition-all duration-200 hover:border-white/[0.12]",
                !notification.read &&
                  activeTab !== "archived" &&
                  "border-primary/20 bg-primary/[0.02]"
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                      getNotificationColor(notification.type)
                    )}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-base font-medium">
                          {notification.title}
                        </CardTitle>
                        <CardDescription className="mt-1 text-sm leading-relaxed">
                          {notification.message}
                        </CardDescription>
                      </div>
                      {!notification.read && activeTab !== "archived" && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between pt-0">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0.5",
                      getNotificationColor(notification.type)
                    )}
                  >
                    {getNotificationLabel(notification.type)}
                  </Badge>
                  <time dateTime={notification.createdAt}>
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </time>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {activeTab === "archived" ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleUnarchive(notification.id)}
                        title="Unarchive"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(notification.id)}
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleMarkRead(notification.id)}
                          title="Mark as read"
                        >
                          <Check className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleArchive(notification.id)}
                        title="Archive"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(notification.id)}
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground/60">
        <span>
          Showing {filteredNotifications.length} of {allNotifications.length}{" "}
          notifications
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          Real-time updates enabled
        </span>
      </div>
    </div>
  )
}