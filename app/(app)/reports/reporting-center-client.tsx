"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Download, FileSpreadsheet, FileText } from "lucide-react"

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
import { cn } from "@/lib/utils"

type ReportKey = "compliance" | "payments" | "employees" | "clients"

function toIsoDateTime(d: Date) {
  // Use end-of-day / start-of-day semantics by keeping full ISO; filters parse as Date.
  return d.toISOString()
}

function currencyINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

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
    setLoading(true)
    try {
      const payload = await getReportingCenterData(next)
      setData(payload)
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load reports")
    } finally {
      setLoading(false)
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

  const exportUrl = (formatKey: "csv" | "xlsx" | "pdf") => {
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
            onClick={() => window.open(exportUrl("pdf"), "_blank", "noopener,noreferrer")}
            className="h-9 rounded-xl gap-2"
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(exportUrl("xlsx"), "_blank", "noopener,noreferrer")}
            className="h-9 rounded-xl gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(exportUrl("csv"), "_blank", "noopener,noreferrer")}
            className="h-9 rounded-xl gap-2"
          >
            <Download className="h-4 w-4" />
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
            <Label>Department</Label>
            <select
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
            <Label>Employee</Label>
            <select
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
            <Label>Client</Label>
            <select
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

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Loading reports…
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          No data.
        </div>
      ) : (
        <>
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
                    {(selected.upcoming as any[]).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.client?.name ?? "-"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {row.title}
                        </TableCell>
                        <TableCell>{format(new Date(row.dueDate), "PPP")}</TableCell>
                      </TableRow>
                    ))}
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
                    {(selected.overdue as any[]).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.client?.name ?? "-"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {row.title}
                        </TableCell>
                        <TableCell>{format(new Date(row.dueDate), "PPP")}</TableCell>
                      </TableRow>
                    ))}
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
                    {(selected.outstandingInvoices as any[]).slice(0, 20).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.invoiceNumber}</TableCell>
                        <TableCell>{row.client?.name ?? "-"}</TableCell>
                        <TableCell>{format(new Date(row.dueDate), "PPP")}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currencyINR(Number(row.outstandingAmount))}
                        </TableCell>
                      </TableRow>
                    ))}
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
                    {(selected.paidInvoices as any[]).slice(0, 20).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.invoiceNumber}</TableCell>
                        <TableCell>{row.client?.name ?? "-"}</TableCell>
                        <TableCell>{format(new Date(row.issueDate), "PPP")}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {currencyINR(Number(row.paidAmount))}
                        </TableCell>
                      </TableRow>
                    ))}
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
                  {(selected.employees as any[]).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.department ?? "-"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.assigned}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.overdue}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.productivity}%</TableCell>
                    </TableRow>
                  ))}
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
                  {(selected.clients as any[]).map((row) => (
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
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
