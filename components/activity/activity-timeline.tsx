"use client"

import { useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import {
  User,
  Building2,
  CheckSquare,
  DollarSign,
  FileText,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Activity,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface ActivityTimelineProps {
  logs: any[]
  hasMore?: boolean
  onLoadMore?: () => void
  showFilters?: boolean
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

export function ActivityTimeline({ logs, hasMore, onLoadMore, showFilters = true }: ActivityTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [entityFilter, setEntityFilter] = useState<string>("ALL")

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesEntity = entityFilter === "ALL" || log.entityType === entityFilter
    return matchesSearch && matchesEntity
  })

  const entityTypes = ["ALL", ...Array.from(new Set(logs.map((log) => log.entityType)))]

  return (
    <div className="space-y-6">
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-premium h-10 rounded-xl"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2">
                <Filter className="h-4 w-4" />
                {entityFilter === "ALL" ? "All Types" : entityFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {entityTypes.map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => setEntityFilter(type)}
                  className={cn(entityFilter === type && "bg-primary/10")}
                >
                  {type === "ALL" ? "All Types" : type}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredLogs.map((log, index) => {
              const Icon = ENTITY_ICONS[log.entityType] || Activity
              const colorClass = ENTITY_COLORS[log.entityType] || "text-gray-400 bg-gray-500/10"
              const isExpanded = expandedId === log.id

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Card className="bg-white/[0.02] border-white/[0.08] p-4 ml-12">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={cn("absolute left-0 p-2 rounded-lg", colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {log.entityType}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                {log.action}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">{log.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {log.userName && (
                                <div className="flex items-center gap-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[8px]">
                                      {log.userName.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{log.userName}</span>
                                </div>
                              )}
                              <span>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="h-8 w-8 shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {/* Expanded details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 pt-4 border-t border-white/[0.08] space-y-2">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Entity ID:</span>
                                    <span className="ml-2 font-mono">{log.entityId}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Timestamp:</span>
                                    <span className="ml-2">{format(new Date(log.timestamp), "MMM d, yyyy h:mm a")}</span>
                                  </div>
                                </div>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-2">Metadata:</p>
                                    <pre className="text-xs bg-white/[0.02] p-2 rounded-lg overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} className="rounded-xl">
            Load More
          </Button>
        </div>
      )}

      {filteredLogs.length === 0 && (
        <Card className="bg-white/[0.02] border-white/[0.08] p-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No activities found</p>
        </Card>
      )}
    </div>
  )
}
