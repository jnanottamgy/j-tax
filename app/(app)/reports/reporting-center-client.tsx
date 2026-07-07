"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, format, subDays } from "date-fns"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"

import {
  getReportFilterOptions,
  getReportingCenterData,
  type ReportFilters,
} from "@/app/actions/reports"
import { GlassCard } from "@/components/dashboard/glass-card"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SectionHeading } from "@/components/ui/section-heading"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { formatINR } from "@/lib/india/format"
import { cn } from "@/lib/utils"

type ReportKey = "compliance" | "payments" | "employees" | "clients"
type ExportFormat = "csv" | "xlsx" | "pdf"

function toIsoDateTime(d: Date) {
  // Use end-of-day / start-of-day semantics by keeping full ISO; filters parse as Date.
  return d.toISOString()
}

const currencyINR = (n: number) => formatINR(n)

function StatBarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>
}) {
  return (
    <div className="h-[260px] min-h-[260px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(1 0 0 / 6%)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 11 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "oklch(0.62 0.02 265)", fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "oklch(1 0 0 / 4%)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="surface-elevated rounded-xl px-3.5 py-2.5">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {label}
                  </p>
                  <div className="text-xs">
                    <span className="font-medium tabular-nums">
                      {payload[0].value as number}
                    </span>
                  </div>
                </div>
              )
            }}
          />
          <Bar
            dataKey="value"
            fill="var(--chart-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={64}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ReportingCenterClient() {
  const now = useMemo(() => new Date(), [])
  const [activeReport, setActiveReport] = useState<ReportKey>("compliance")

  const [filters, setFilters] = useState<ReportFilters>(() => ({
    startDate: toIsoDateTime(subDays(now, 30)),
    endDate: toIsoDateTime(addDays(now, 30)),
  }))

  const [options, setOptions] = useState<{
    employees: Array<{ id: string; name: string; department: string | null }>
    clients: Array<{ id: string; name: string }>
    departments: string[]
  }>({ employees: [], clients: [], departments: [] })

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const opts = await getReportFilterOptions()
        if (!cancelled) setOptions(opts)
      } catch (_e) {
        toast.error("Failed to load report filters")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = async (next: ReportFilters) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const payload = await getReportingCenterData(next)
      if (requestId !== requestIdRef.current) return // stale response; ignore
      setData(payload)
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return
      toast.error(e?.message ?? "Failed to load reports")
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    load(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.employeeId, filters.clientId, filters.department])

  const setDate = (key: "startDate" | "endDate", value: string) => {
    // Convert yyyy-mm-dd to ISO at start/end
    if (!value) {
      setFilters((f) => ({ ...f, [key]: undefined }))
      return
    }
    const d = new Date(value + "T00:00:00.000Z")
    setFilters((f) => ({ ...f, [key]: toIsoDateTime(d) }))
  }

  const exportUrl = (formatKey: ExportFormat) => {
    const params = new URLSearchParams()
    params.set("report", activeReport)
    params.set("format", formatKey)
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.employeeId) params.set("employeeId", filters.employeeId)
    if (filters.clientId) params.set("clientId", filters.clientId)
    if (filters.department) params.set("department", filters.department)
    return `/reports/export?${params.toString()}`
  }

  const handleExport = async (formatKey: ExportFormat) => {
    if (exporting) return
    setExporting(formatKey)
    try {
      const res = await fetch(exportUrl(formatKey))
      if (!res.ok) {
        if (res.status === 429) {
          toast.error("Too many export requests. Please wait a moment and try again.")
        } else if (res.status === 401 || res.status === 403) {
          toast.error("You don't have permission to export this report.")
        } else {
          toast.error("Export failed. Please try again.")
        }
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `report.${formatKey}`
      const blobUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = blobUrl
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(blobUrl)
      toast.success("Report downloaded")
    } catch (_e) {
      toast.error("Export failed. Check your connection and try again.")
    } finally {
      setExporting(null)
    }
  }

  const reportNav = [
    { key: "compliance" as const, label: "Compliance" },
    { key: "payments" as const, label: "Payments" },
    { key: "employees" as const, label: "Employees" },
    { key: "clients" as const, label: "Clients" },
  ]

  const selected = data?.[activeReport]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Reporting Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Enterprise reporting with filters and exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            className="h-9 rounded-xl gap-2"
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={exporting !== null}
            className="h-9 rounded-xl gap-2"
          >
            {exporting === "xlsx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exporting !== null}
            className="h-9 rounded-xl gap-2"
          >
            {exporting === "csv" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            CSV
          </Button>
        </div>
      </div>

      {/* Report tabs */}
      <div className="flex flex-wrap gap-2">
        {reportNav.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={activeReport === item.key ? "default" : "outline"}
            className={cn("h-9 rounded-xl", activeReport === item.key && "btn-glow")}
            onClick={() => setActiveReport(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-white/[0.02] border-white/[0.08] p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label>Date start</Label>
            <Input
              type="date"
              value={filters.startDate ? filters.startDate.slice(0, 10) : ""}
              onChange={(e) => setDate("startDate", e.target.value)}
              className="h-10 rounded-xl input-premium"
            />
          </div>
          <div className="space-y-2">
            <Label>Date end</Label>
            <Input
              type="date"
              value={filters.endDate ? filters.endDate.slice(0, 10) : ""}
              onChange={(e) => setDate("endDate", e.target.value)}
              className="h-10 rounded-xl input-premium"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-filter-department">Department</Label>
            <select
              id="report-filter-department"
              value={filters.department ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  department: e.target.value || undefined,
                  employeeId: undefined, // keep filters consistent
                }))
              }
              className="w-full h-10 rounded-xl border border-white/[0.12] bg-background px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {options.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-filter-employee">Employee</Label>
            <select
              id="report-filter-employee"
              value={filters.employeeId ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, employeeId: e.target.value || undefined }))
              }
              className="w-full h-10 rounded-xl border border-white/[0.12] bg-background px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {options.employees
                .filter((emp) => !filters.department || emp.department === filters.department)
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-filter-client">Client</Label>
            <select
              id="report-filter-client"
              value={filters.clientId ?? ""}
              onChange={(e) =>
                setFilters((f) => ({ ...f, clientId: e.target.value || undefined }))
              }
              className="w-full h-10 rounded-xl border border-white/[0.12] bg-background px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {options.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Tip: exports reflect the currently selected report + filters.
        </div>
      </Card>

      {!data ? (
        loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reports…
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            No data.
          </div>
        )
      ) : (
        <div
          aria-busy={loading}
          className={cn(
            "space-y-6 transition-opacity",
            loading && "pointer-events-none opacity-50"
          )}
        >
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating reports…
            </div>
          )}
          {/* Executive summary chart */}
          <GlassCard hover={false} className="p-6">
            <SectionHeading
              title="Executive dashboard"
              description={`Report: ${activeReport} • Updated ${format(
                new Date(selected?.meta?.generatedAt ?? new Date()),
                "PPp"
              )}`}
            />

            {activeReport === "compliance" && (
              <StatBarChart
                data={[
                  { label: "Upcoming", value: selected.stats.upcoming },
                  { label: "Overdue", value: selected.stats.overdue },
                  { label: "Completed", value: selected.stats.completed },
                ]}
              />
            )}

            {activeReport === "payments" && (
              <StatBarChart
                data={[
                  { label: "Invoiced", value: Math.round(selected.stats.totalInvoiced) },
                  { label: "Collected", value: Math.round(selected.stats.totalCollected) },
                  { label: "Outstanding", value: Math.round(selected.stats.totalOutstanding) },
                ]}
              />
            )}

            {activeReport === "employees" && (
              <StatBarChart
                data={(selected.employees as any[])
                  .slice(0, 10)
                  .map((e) => ({ label: e.name, value: e.productivity }))}
              />
            )}

            {activeReport === "clients" && (
              <StatBarChart
                data={(selected.clients as any[])
                  .slice(0, 10)
                  .map((c) => ({ label: c.name, value: c.complianceScore }))}
              />
            )}
          </GlassCard>

          {/* Tables */}
          {activeReport === "compliance" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="bg-white/[0.02] border-white/[0.08] p-4">
                <SectionHeading
                  title="Upcoming filings"
                  description="Soonest due items"
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selected.upcoming as any[]).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No data for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selected.upcoming as any[]).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.client?.name ?? "-"}</TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {row.title}
                          </TableCell>
                          <TableCell>{format(new Date(row.dueDate), "PPP")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="bg-white/[0.02] border-white/[0.08] p-4">
                <SectionHeading
                  title="Overdue filings"
                  description="Items past due"
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selected.overdue as any[]).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No data for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selected.overdue as any[]).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.client?.name ?? "-"}</TableCell>
                          <TableCell className="max-w-[280px] truncate">
                            {row.title}
                          </TableCell>
                          <TableCell>{format(new Date(row.dueDate), "PPP")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {activeReport === "payments" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="bg-white/[0.02] border-white/[0.08] p-4">
                <SectionHeading
                  title="Outstanding invoices"
                  description="Highest priority collections"
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selected.outstandingInvoices as any[]).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No data for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selected.outstandingInvoices as any[]).slice(0, 20).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.invoiceNumber}</TableCell>
                          <TableCell>{row.client?.name ?? "-"}</TableCell>
                          <TableCell>{format(new Date(row.dueDate), "PPP")}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {currencyINR(Number(row.outstandingAmount))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>

              <Card className="bg-white/[0.02] border-white/[0.08] p-4">
                <SectionHeading title="Paid invoices" description="Recent collections" />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selected.paidInvoices as any[]).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No data for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (selected.paidInvoices as any[]).slice(0, 20).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.invoiceNumber}</TableCell>
                          <TableCell>{row.client?.name ?? "-"}</TableCell>
                          <TableCell>{format(new Date(row.issueDate), "PPP")}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {currencyINR(Number(row.paidAmount))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}

          {activeReport === "employees" && (
            <Card className="bg-white/[0.02] border-white/[0.08] p-4">
              <SectionHeading
                title="Employee productivity"
                description="Tasks completed, productivity %, and overdue tasks"
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Assigned</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                    <TableHead className="text-right">Productivity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selected.employees as any[]).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No data for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (selected.employees as any[]).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.department ?? "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.assigned}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.overdue}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.productivity}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}

          {activeReport === "clients" && (
            <Card className="bg-white/[0.02] border-white/[0.08] p-4">
              <SectionHeading
                title="Client report"
                description="Compliance score, outstanding payments, and open tasks"
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Compliance score</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Open tasks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selected.clients as any[]).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No data for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (selected.clients as any[]).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.assignedEmployeeName ?? "-"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.complianceScore}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currencyINR(row.outstandingPayments)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{row.openTasks}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
