/**
 * Shared metric identifiers for the dashboard drill-downs.
 *
 * Kept out of the "use server" action file because such files may only export
 * async functions — a plain object export there fails the build.
 */

export type InsightMetric =
  | "compliance"
  | "high-risk"
  | "approvals"
  | "pipeline"
  | "leads"
  | "followups"
  | "employees"

export const INSIGHT_TITLES: Record<InsightMetric, string> = {
  compliance: "Compliance Score",
  "high-risk": "High Risk Clients",
  approvals: "Pending Approvals",
  pipeline: "Revenue Pipeline",
  leads: "Total Leads",
  followups: "Follow-Up Required",
  employees: "Active Employees",
}

export const INSIGHT_METRICS = Object.keys(INSIGHT_TITLES) as InsightMetric[]

export type InsightColumn = {
  key: string
  label: string
  /** Drives alignment and formatting in both the table and the export. */
  type?: "text" | "number" | "currency" | "date" | "status" | "danger"
}

export type InsightRow = {
  id: string
  /** Where clicking the row goes, when the record has its own page. */
  href?: string
  cells: Record<string, string | number | null>
}

export type Insight = {
  metric: InsightMetric
  title: string
  description: string
  columns: InsightColumn[]
  rows: InsightRow[]
  summary: { label: string; value: string }[]
}
