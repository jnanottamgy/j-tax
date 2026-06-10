"use client"

import { motion } from "framer-motion"
import { FileText, Calendar, DollarSign, Users, Search } from "lucide-react"
import Link from "next/link"

import { GlassCard } from "@/components/dashboard/glass-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QuickAction {
  label: string
  description: string
  icon: any
  href: string
  color: string
  bgColor: string
}

const quickActions: QuickAction[] = [
  {
    label: "Add Client",
    description: "Onboard new client",
    icon: Users,
    href: "/clients",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    label: "Create Task",
    description: "Assign new task",
    icon: FileText,
    href: "/work-tracker",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    label: "Add Invoice",
    description: "Generate invoice",
    icon: DollarSign,
    href: "/payments/invoices",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    label: "Schedule Event",
    description: "Set compliance deadline",
    icon: Calendar,
    href: "/compliance",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
]

export function QuickActions() {
  return (
    <GlassCard hover={false} className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Quick Actions</h3>
        <kbd className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] text-muted-foreground">
          <span className="font-medium">⌘</span>K
        </kbd>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action, index) => {
          const Icon = action.icon
          return (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Link href={action.href}>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-auto p-4 flex flex-col items-center gap-2 rounded-xl border-white/[0.07] bg-transparent hover:bg-white/[0.04] transition-colors",
                    "input-premium"
                  )}
                >
                  <div className={cn("p-2 rounded-lg", action.bgColor)}>
                    <Icon className={cn("h-5 w-5", action.color)} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                </Button>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <Link href="/clients">
          <Button variant="ghost" size="sm" className="w-full gap-2">
            <Search className="h-4 w-4" />
            Search or use Command Palette
          </Button>
        </Link>
      </div>
    </GlassCard>
  )
}
