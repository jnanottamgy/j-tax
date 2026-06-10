"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface RecentItem {
  href: string
  title: string
  visitedAt: number
}

interface SidebarState {
  favorites: string[]
  recentItems: RecentItem[]
  collapsedGroups: string[]

  addFavorite: (href: string) => void
  removeFavorite: (href: string) => void
  isFavorite: (href: string) => boolean

  addRecentItem: (item: Omit<RecentItem, "visitedAt">) => void

  toggleGroup: (groupId: string) => void
  isGroupCollapsed: (groupId: string) => boolean
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recentItems: [],
      collapsedGroups: [],

      addFavorite: (href) =>
        set((s) => ({
          favorites: s.favorites.includes(href)
            ? s.favorites
            : [...s.favorites, href],
        })),

      removeFavorite: (href) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f !== href) })),

      isFavorite: (href) => get().favorites.includes(href),

      addRecentItem: ({ href, title }) =>
        set((s) => {
          const filtered = s.recentItems.filter((i) => i.href !== href)
          return {
            recentItems: [
              { href, title, visitedAt: Date.now() },
              ...filtered,
            ].slice(0, 5),
          }
        }),

      toggleGroup: (groupId) =>
        set((s) => ({
          collapsedGroups: s.collapsedGroups.includes(groupId)
            ? s.collapsedGroups.filter((id) => id !== groupId)
            : [...s.collapsedGroups, groupId],
        })),

      isGroupCollapsed: (groupId) => get().collapsedGroups.includes(groupId),
    }),
    { name: "j-tax-sidebar-state" }
  )
)
