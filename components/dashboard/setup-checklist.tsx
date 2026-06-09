"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type SetupChecklistData = {
  hasEmployees: boolean
  hasClients: boolean
  hasTasks: boolean
  hasDocuments: boolean
  hasInvoices: boolean
  hasCompliance: boolean
}

const STEPS = [
  {
    id: "employees",
    label: "Add your team members",
    description: "Create employee accounts for your staff",
    href: "/employees",
    key: "hasEmployees" as keyof SetupChecklistData,
  },
  {
    id: "clients",
    label: "Add your first client",
    description: "Create a client profile with their tax services",
    href: "/clients",
    key: "hasClients" as keyof SetupChecklistData,
  },
  {
    id: "tasks",
    label: "Create a work task",
    description: "Track a filing or review in the Work Tracker",
    href: "/work-tracker",
    key: "hasTasks" as keyof SetupChecklistData,
  },
  {
    id: "compliance",
    label: "Review compliance deadlines",
    description: "Check upcoming statutory due dates",
    href: "/compliance",
    key: "hasCompliance" as keyof SetupChecklistData,
  },
  {
    id: "documents",
    label: "Upload a document",
    description: "Store a client document securely",
    href: "/documents",
    key: "hasDocuments" as keyof SetupChecklistData,
  },
  {
    id: "invoices",
    label: "Create an invoice",
    description: "Start tracking client billing",
    href: "/payments/invoices",
    key: "hasInvoices" as keyof SetupChecklistData,
  },
]

export function SetupChecklist({ data }: { data: SetupChecklistData }) {
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const completedCount = STEPS.filter((s) => data[s.key]).length
  const totalCount = STEPS.length
  const allDone = completedCount === totalCount

  // Once all steps done, only show a success banner for a moment
  if (allDone || dismissed) return null

  const progressPct = Math.round((completedCount / totalCount) * 100)

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Get started with J-TAX
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {completedCount} / {totalCount} complete
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
            >
              {collapsed ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronUp className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss setup checklist"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="px-5 pb-4">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {STEPS.map((step) => {
              const done = data[step.key]
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-2.5 text-sm transition-colors",
                    done
                      ? "opacity-50 cursor-default pointer-events-none"
                      : "hover:bg-primary/10 cursor-pointer"
                  )}
                  tabIndex={done ? -1 : undefined}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className={cn("font-medium leading-tight", done && "line-through text-muted-foreground")}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
