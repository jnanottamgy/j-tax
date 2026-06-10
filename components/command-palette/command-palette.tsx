"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  X,
  ArrowRight,
  Command,
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  FileText,
  MessageSquare,
  Activity,
  Plus,
  Upload,
  Building2,
  DollarSign,
  User,
  ChevronRight,
  Clock,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { globalSearch, getQuickCommands } from "@/app/actions/search"
import { cn } from "@/lib/utils"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ENTITY_ICONS: Record<string, any> = {
  CLIENT: Building2,
  TASK: CheckSquare,
  INVOICE: DollarSign,
  DOCUMENT: FileText,
  EMPLOYEE: User,
  COMPLIANCE: Calendar,
}

const ENTITY_COLORS: Record<string, string> = {
  CLIENT: "text-blue-400 bg-blue-500/10",
  TASK: "text-green-400 bg-green-500/10",
  INVOICE: "text-yellow-400 bg-yellow-500/10",
  DOCUMENT: "text-purple-400 bg-purple-500/10",
  EMPLOYEE: "text-pink-400 bg-pink-500/10",
  COMPLIANCE: "text-orange-400 bg-orange-500/10",
}

const COMMAND_ICONS: Record<string, any> = {
  "nav-dashboard": LayoutDashboard,
  "nav-clients": Users,
  "nav-work-tracker": CheckSquare,
  "nav-calendar": Calendar,
  "nav-documents": FileText,
  "nav-messaging": MessageSquare,
  "nav-activity": Activity,
  "action-create-client": Plus,
  "action-create-task": Plus,
  "action-create-invoice": Plus,
  "action-upload-document": Upload,
  "action-add-employee": Plus,
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [commands, setCommands] = useState<any[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("recent-searches")
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved))
        } catch (error) {
          console.error("Failed to parse recent searches:", error)
        }
      }
    }
  }, [])

  // Save search to recent searches
  const saveRecentSearch = (searchQuery: string) => {
    if (searchQuery.length < 2) return

    const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5)
    setRecentSearches(updated)

    if (typeof window !== "undefined") {
      localStorage.setItem("recent-searches", JSON.stringify(updated))
    }
  }

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([])
    if (typeof window !== "undefined") {
      localStorage.removeItem("recent-searches")
    }
  }

  const loadCommands = useCallback(async () => {
    try {
      const data = await getQuickCommands()
      setCommands(data.commands)
    } catch (error) {
      console.error("Failed to load commands:", error)
    }
  }, [])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      loadCommands()
    }
  }, [open, loadCommands])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === "Escape") {
        onOpenChange(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  const debouncedSearch = useCallback((searchQuery: string) => {
    clearTimeout(searchTimeoutRef.current)

    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(searchQuery)
        setResults(data.results)
        setSelectedIndex(0)
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setIsLoading(false)
      }
    }, 300)
  }, [])

  useEffect(() => {
    debouncedSearch(query)
  }, [query, debouncedSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items: any[] = query.length >= 2 ? results : commands

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % items.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (items[selectedIndex]) {
        handleItemClick(items[selectedIndex])
      }
    }
  }

  const handleItemClick = (item: any) => {
    if (item.url) {
      if (query.length >= 2) {
        saveRecentSearch(query)
      }
      router.push(item.url)
      onOpenChange(false)
      setQuery("")
      setResults([])
    }
  }

  const handleRecentSearchClick = (searchQuery: string) => {
    setQuery(searchQuery)
    inputRef.current?.focus()
  }

  const groupedResults = results.reduce((acc: Record<string, any[]>, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, any[]>)

  const _items = query.length >= 2 ? results : commands

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => onOpenChange(false)}
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-2xl z-50"
          >
            <div className="bg-background border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 p-4 border-b border-white/[0.08]">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Search clients, tasks, invoices, documents..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base"
                />
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 text-xs font-medium bg-white/[0.04] rounded-md border border-white/[0.08]">
                    ESC
                  </kbd>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onOpenChange(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground">Searching...</div>
                  </div>
                ) : query.length >= 2 ? (
                  // Search Results
                  Object.keys(groupedResults).length > 0 ? (
                    Object.entries(groupedResults).map(([type, items]: [string, any[]]) => (
                      <div key={type} className="mb-4">
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {type}
                        </div>
                        {items.map((item: any, index: number) => {
                          const Icon = ENTITY_ICONS[item.type] || Search
                          const colorClass = ENTITY_COLORS[item.type] || "text-gray-400 bg-gray-500/10"
                          const globalIndex = results.indexOf(item)

                          return (
                            <motion.button
                              key={item.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.1, delay: index * 0.05 }}
                              onClick={() => handleItemClick(item)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors",
                                selectedIndex === globalIndex && "bg-white/[0.08]"
                              )}
                            >
                              <div className={cn("p-2 rounded-lg", colorClass)}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-sm font-medium">{item.title}</p>
                                {item.subtitle && (
                                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                            </motion.button>
                          )
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No results found</p>
                    </div>
                  )
                ) : (
                  // Quick Commands & Recent Searches
                  <div className="space-y-4">
                    {recentSearches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Recent Searches
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={clearRecentSearches}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {recentSearches.map((search, index) => (
                          <motion.button
                            key={search}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.1, delay: index * 0.05 }}
                            onClick={() => handleRecentSearchClick(search)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="p-2 rounded-lg bg-muted/10 text-muted-foreground">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium">{search}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Quick Actions
                    </div>
                    {commands.map((command, index) => {
                      const Icon = COMMAND_ICONS[command.id] || ArrowRight
                      return (
                        <motion.button
                          key={command.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.1, delay: index * 0.05 }}
                          onClick={() => handleItemClick(command)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors",
                            selectedIndex === index && "bg-white/[0.08]"
                          )}
                        >
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium">{command.title}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                        </motion.button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08] text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs bg-white/[0.04] rounded border border-white/[0.08]">↑↓</kbd>
                    <span>Navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs bg-white/[0.04] rounded border border-white/[0.08]">↵</kbd>
                    <span>Select</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs bg-white/[0.04] rounded border border-white/[0.08]">
                    <Command className="h-3 w-3" />
                  </kbd>
                  <kbd className="px-1.5 py-0.5 text-xs bg-white/[0.04] rounded border border-white/[0.08]">K</kbd>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
