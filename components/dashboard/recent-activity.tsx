"use client"

import Link from "next/link"
import { AlertCircle, FileText, Receipt, Shield, Activity } from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { SectionHeading } from "@/components/ui/section-heading"
import { cn } from "@/lib/utils"

interface ActivityLog {
  id: string
  entityType: string
  action: string
  description: string
  userName?: string | null
  timestamp: Date
}

const entityIconMap: Record<string, React.ElementType> = {
  CLIENT: FileText,
  TASK: Shield,
  INVOICE: Receipt,
  DOCUMENT: FileText,
  COMPLIANCE: AlertCircle,
  EMPLOYEE: FileText,
  SEARCH: Activity,
}

const entityColorMap: Record<string, string> = {
  CLIENT: "text-primary bg-primary/10",
  TASK: "text-sky-400 bg-sky-500/10",
  INVOICE: "text-emerald-400 bg-emerald-500/10",
  DOCUMENT: "text-violet-400 bg-violet-500/10",
  COMPLIANCE: "text-amber-400 bg-amber-500/10",
  EMPLOYEE: "text-pink-400 bg-pink-500/10",
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RecentActivity({ logs }: { logs: ActivityLog[] }) {
  const visible = logs.filter(
    (l) => l.entityType !== "SEARCH" && l.entityType !== "SEARCH_HISTORY"
  )

  return (
    <GlassCard className="flex h-full flex-col p-6" hover={false}>
      <SectionHeading
        title="Recent Activity"
        description="Latest actions across your workspace"
        action={
          <Link
            href="/activity"
            className="text-[12px] font-medium text-primary transition-colors duration-300 hover:text-primary/80"
          >
            View all
          </Link>
        }
      />

      {visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-1">
          {visible.map((item, index) => {
            const Icon = entityIconMap[item.entityType] ?? Activity
            const color = entityColorMap[item.entityType] ?? "text-muted-foreground bg-white/[0.04]"
            return (
              <li
                key={item.id}
                className={cn(
                  "group flex items-start gap-3 rounded-xl px-3 py-3 transition-all duration-300 hover:bg-white/[0.04]",
                  index !== visible.length - 1 && "border-b border-white/[0.04]"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    color
                  )}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-snug">{item.description}</p>
                  {item.userName && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {item.userName}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground/80">
                  {timeAgo(item.timestamp)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
