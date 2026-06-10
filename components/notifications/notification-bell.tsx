"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, Check, CheckCheck, Archive, X, Settings } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/components/notifications/notifications-provider"
import type { NotificationDTO } from "@/app/actions/notifications"

function getNotificationIcon(type: string) {
  switch (type) {
    case "TASK_ASSIGNED":
      return "📋"
    case "TASK_OVERDUE":
      return "⚠️"
    case "COMPLIANCE_DUE":
      return "📅"
    case "PAYMENT_RECEIVED":
      return "💰"
    case "INVOICE_OVERDUE":
      return "💳"
    case "DOCUMENT_UPLOADED":
      return "📄"
    case "WARNING":
      return "⚡"
    case "ALERT":
      return "🚨"
    default:
      return "🔔"
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case "TASK_ASSIGNED":
      return "bg-blue-500/10 text-blue-500"
    case "TASK_OVERDUE":
      return "bg-orange-500/10 text-orange-500"
    case "COMPLIANCE_DUE":
      return "bg-purple-500/10 text-purple-500"
    case "PAYMENT_RECEIVED":
      return "bg-green-500/10 text-green-500"
    case "INVOICE_OVERDUE":
      return "bg-red-500/10 text-red-500"
    case "DOCUMENT_UPLOADED":
      return "bg-cyan-500/10 text-cyan-500"
    case "WARNING":
      return "bg-yellow-500/10 text-yellow-500"
    case "ALERT":
      return "bg-red-500/10 text-red-500"
    default:
      return "bg-gray-500/10 text-gray-500"
  }
}

type NotificationDropdownProps = {
  onClose: () => void
}

function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    archive,
    soundEnabled,
    setSoundEnabled,
  } = useNotifications()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const recentNotifications = notifications.slice(0, 10)

  const handleNotificationClick = (notification: NotificationDTO) => {
    if (!notification.read) {
      markRead(notification.id)
    }
    // Navigate to notifications page for full view
    router.push("/notifications")
    onClose()
  }

  const handleMarkAllRead = async () => {
    await markAllRead()
  }

  const handleArchive = async (id: string) => {
    await archive(id)
  }

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/[0.08] bg-[#0A0A0E]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
      role="menu"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-[10px] font-semibold bg-primary/20 text-primary"
            >
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
              title="Mark all as read"
            >
              <CheckCheck className="size-3.5 mr-1" />
              Mark all read
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              router.push("/notifications")
              onClose()
            }}
          >
            View all
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[400px] overflow-y-auto">
        {recentNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No notifications
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              You&apos;re all caught up!
            </p>
          </div>
        ) : (
          <div className="py-2">
            {recentNotifications.map((notification) => (
              <div
                key={notification.id}
                className={cn(
                  "group relative flex gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer",
                  !notification.read && "bg-primary/[0.03]"
                )}
                onClick={() => handleNotificationClick(notification)}
                role="menuitem"
              >
                {/* Type Indicator */}
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm",
                    getNotificationColor(notification.type)
                  )}
                >
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm font-medium leading-tight line-clamp-2",
                        !notification.read && "text-foreground"
                      )}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-primary mt-1.5"
                        aria-hidden
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <time
                      className="text-[10px] text-muted-foreground/60"
                      dateTime={notification.createdAt}
                    >
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </time>
                    <span className="text-[10px] text-muted-foreground/40">
                      •
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 capitalize">
                      {notification.type.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                </div>

                {/* Actions (visible on hover) */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#0A0A0E] rounded-lg">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        markRead(notification.id)
                      }}
                      title="Mark as read"
                    >
                      <Check className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleArchive(notification.id)
                    }}
                    title="Archive"
                  >
                    <Archive className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClose()
                    }}
                    title="Dismiss"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with Sound Toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
        <button
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {
            router.push("/settings")
            onClose()
          }}
        >
          <Settings className="size-3.5" />
          Notification settings
        </button>
        <button
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
            soundEnabled
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setSoundEnabled(!soundEnabled)}
          title={soundEnabled ? "Sound on" : "Sound off"}
        >
          <Bell className={cn("size-3.5", soundEnabled && "text-primary")} />
          <span>{soundEnabled ? "Sound on" : "Sound off"}</span>
        </button>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const { unreadCount } = useNotifications()

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "relative size-9 rounded-xl text-muted-foreground transition-all duration-300 hover:bg-white/[0.05] hover:text-foreground",
          isOpen && "bg-white/[0.05] text-foreground"
        )}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <>
            <span
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground shadow-[0_0_8px_oklch(0.7_0.16_265/60%)]"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
            {/* Pulse animation for new notifications */}
            <span
              className="absolute -top-0.5 -right-0.5 size-4 animate-ping rounded-full bg-primary/50"
              aria-hidden
            />
          </>
        )}
      </Button>

      {isOpen && <NotificationDropdown onClose={() => setIsOpen(false)} />}
    </div>
  )
}