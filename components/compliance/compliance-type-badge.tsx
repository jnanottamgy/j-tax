import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ComplianceType = "GSTR_1" | "GSTR_3B" | "TDS" | "ROC" | "ITR" | "PF_ESIC" | "AUDIT" | "CUSTOM"

const complianceTypeConfig: Record<ComplianceType, { label: string; className: string; color: string }> = {
  GSTR_1:  { label: "GSTR-1",  className: "bg-blue-500/10 text-blue-400 border-blue-500/20",   color: "#3b82f6" },
  GSTR_3B: { label: "GSTR-3B", className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",   color: "#06b6d4" },
  TDS:     { label: "TDS",     className: "bg-purple-500/10 text-purple-400 border-purple-500/20", color: "#a855f7" },
  ROC:     { label: "ROC",     className: "bg-orange-500/10 text-orange-400 border-orange-500/20", color: "#f97316" },
  ITR:     { label: "ITR",     className: "bg-green-500/10 text-green-400 border-green-500/20",  color: "#22c55e" },
  PF_ESIC: { label: "PF/ESIC", className: "bg-pink-500/10 text-pink-400 border-pink-500/20",    color: "#ec4899" },
  AUDIT:   { label: "Audit",   className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", color: "#eab308" },
  CUSTOM:  { label: "Custom",  className: "bg-slate-500/10 text-slate-400 border-slate-500/20", color: "#64748b" },
}

interface ComplianceTypeBadgeProps {
  type: ComplianceType
  className?: string
}

export function ComplianceTypeBadge({ type, className }: ComplianceTypeBadgeProps) {
  const config = complianceTypeConfig[type] ?? complianceTypeConfig.CUSTOM
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}

export function getComplianceTypeColor(type: ComplianceType): string {
  return (complianceTypeConfig[type] ?? complianceTypeConfig.CUSTOM).color
}

export const COMPLIANCE_TYPE_OPTIONS: { value: ComplianceType; label: string }[] = [
  { value: "GSTR_1",  label: "GSTR-1" },
  { value: "GSTR_3B", label: "GSTR-3B" },
  { value: "TDS",     label: "TDS" },
  { value: "ROC",     label: "ROC" },
  { value: "ITR",     label: "Income Tax Return" },
  { value: "PF_ESIC", label: "PF / ESIC" },
  { value: "AUDIT",   label: "Audit" },
  { value: "CUSTOM",  label: "Custom" },
]

export const WORKFLOW_STATUS_OPTIONS = [
  { value: "NOT_STARTED",       label: "Not Started",       color: "text-slate-400" },
  { value: "DOCUMENTS_AWAITED", label: "Documents Awaited", color: "text-yellow-400" },
  { value: "IN_PROGRESS",       label: "In Progress",       color: "text-blue-400" },
  { value: "UNDER_REVIEW",      label: "Under Review",      color: "text-purple-400" },
  { value: "FILED",             label: "Filed",             color: "text-cyan-400" },
  { value: "COMPLETED",         label: "Completed",         color: "text-green-400" },
  { value: "OVERDUE",           label: "Overdue",           color: "text-red-400" },
] as const
