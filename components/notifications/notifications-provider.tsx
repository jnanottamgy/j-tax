"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

import { createClient as createSupabaseClient } from "@/lib/supabase/client"
import { useAuth } from "@/components/auth/auth-provider"
import {
  archiveNotification,
  deleteNotification,
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDTO,
  unarchiveNotification,
} from "@/app/actions/notifications"

type NotificationsState = {
  notifications: NotificationDTO[]
  archived: NotificationDTO[]
  unreadCount: number
  soundEnabled: boolean
  setSoundEnabled: (enabled: boolean) => void
  refresh: () => Promise<void>
  refreshArchived: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  archive: (id: string) => Promise<void>
  unarchive: (id: string) => Promise<void>
  delete: (id: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsState | null>(null)

function playBeep() {
  try {
    const AudioContextImpl =
      (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioContextImpl) return
    const ctx = new AudioContextImpl()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 880
    gain.gain.value = 0.02
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    setTimeout(() => {
      osc.stop()
      ctx.close()
    }, 120)
  } catch {
    // ignore
  }
}

const SOUND_PREF_KEY = "jtax.notifications.sound"

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()

  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [archived, setArchived] = useState<NotificationDTO[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(SOUND_PREF_KEY) === "true"
  })

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled)
    try {
      window.localStorage.setItem(SOUND_PREF_KEY, enabled ? "true" : "false")
    } catch {
      // ignore
    }
  }

  const supabase = useMemo(() => createSupabaseClient(), [])
  const subscribedRef = useRef(false)
  const readyRef = useRef(false)

  const refresh = async () => {
    const res = await listMyNotifications({ includeArchived: false, limit: 50 })
    setNotifications(res.notifications)
    setUnreadCount(res.unreadCount)
    readyRef.current = true
  }

  const refreshArchived = async () => {
    const res = await listMyNotifications({ includeArchived: true, limit: 50 })
    setArchived(res.notifications.filter((n) => n.archived))
    // Keep unread count authoritative from server
    setUnreadCount(res.unreadCount)
  }

  const refreshUnreadCountOnly = async () => {
    const res = await getUnreadNotificationCount()
    setUnreadCount(res.unreadCount)
  }

  const upsert = (arr: NotificationDTO[], row: NotificationDTO) => {
    const idx = arr.findIndex((n) => n.id === row.id)
    if (idx === -1) return [row, ...arr]
    const next = arr.slice()
    next[idx] = row
    return next
  }

  const remove = (arr: NotificationDTO[], id: string) =>
    arr.filter((n) => n.id !== id)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refresh()
        if (!cancelled) {
          // also load archived once so history isn't empty
          await refreshArchived()
        }
      } catch (e) {
        // avoid noisy errors; page components also show toasts
        if (!cancelled) toast.error("Failed to load notifications")
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    if (subscribedRef.current) return
    subscribedRef.current = true

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `userId=eq.${user.id}`,
        },
        (payload: any) => {
          const eventType = payload.eventType
          const nextRow = payload.new
          const oldRow = payload.old

          const toDto = (row: any): NotificationDTO => ({
            id: row.id,
            title: row.title,
            message: row.message,
            type: row.type,
            read: row.read,
            archived: row.archived,
            createdAt: row.createdAt,
          })

          if (eventType === "INSERT" && nextRow) {
            const dto = toDto(nextRow)
            if (!dto.archived) setNotifications((prev) => upsert(prev, dto))
            else setArchived((prev) => upsert(prev, dto))

            // Update unread count opportunistically
            if (!dto.read && !dto.archived) setUnreadCount((n) => n + 1)
            else void refreshUnreadCountOnly()

            // Live UX: toast + optional sound (only after first full load)
            if (readyRef.current) {
              toast(dto.title, { description: dto.message })
              if (soundEnabled) playBeep()
            }
            return
          }

          if (eventType === "UPDATE" && nextRow) {
            const dto = toDto(nextRow)
            if (dto.archived) {
              setNotifications((prev) => remove(prev, dto.id))
              setArchived((prev) => upsert(prev, dto))
            } else {
              setArchived((prev) => remove(prev, dto.id))
              setNotifications((prev) => upsert(prev, dto))
            }
            void refreshUnreadCountOnly()
            return
          }

          if (eventType === "DELETE" && oldRow) {
            const id = oldRow.id
            setNotifications((prev) => remove(prev, id))
            setArchived((prev) => remove(prev, id))
            void refreshUnreadCountOnly()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      subscribedRef.current = false
    }
  }, [supabase, user?.id, soundEnabled])

  const markRead = async (id: string) => {
    const res = await markNotificationRead(id)
    if (!res.success) return
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    void refreshUnreadCountOnly()
  }

  const markAllRead = async () => {
    const res = await markAllNotificationsRead()
    if (!res.success) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const archive = async (id: string) => {
    const res = await archiveNotification(id)
    if (!res.success) return
    // optimistic: move to archived
    setNotifications((prev) => {
      const n = prev.find((x) => x.id === id)
      if (n) setArchived((a) => upsert(a, { ...n, archived: true }))
      return remove(prev, id)
    })
    void refreshUnreadCountOnly()
  }

  const unarchive = async (id: string) => {
    const res = await unarchiveNotification(id)
    if (!res.success) return
    setArchived((prev) => {
      const n = prev.find((x) => x.id === id)
      if (n) setNotifications((a) => upsert(a, { ...n, archived: false }))
      return remove(prev, id)
    })
    void refreshUnreadCountOnly()
  }

  const deleteNotif = async (id: string) => {
    const res = await deleteNotification(id)
    if (!res.success) return
    setNotifications((prev) => remove(prev, id))
    setArchived((prev) => remove(prev, id))
    void refreshUnreadCountOnly()
  }

  const value: NotificationsState = {
    notifications,
    archived,
    unreadCount,
    soundEnabled,
    setSoundEnabled,
    refresh,
    refreshArchived,
    markRead,
    markAllRead,
    archive,
    unarchive,
    delete: deleteNotif,
  }

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return ctx
}

