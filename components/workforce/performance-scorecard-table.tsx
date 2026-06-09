"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { PerformanceMetrics } from "@/app/actions/workforce"

type Props = {
  metrics: PerformanceMetrics[]
  onEmployeeClick: (id: string) => void
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">{score}</Badge>
  if (score >= 60) return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/20">{score}</Badge>
  return <Badge className="bg-red-500/15 text-red-500 border-red-500/20">{score}</Badge>
}

function RateCell({ rate }: { rate: number }) {
  const Icon = rate >= 75 ? TrendingUp : rate >= 50 ? Minus : TrendingDown
  const color = rate >= 75 ? "text-emerald-500" : rate >= 50 ? "text-yellow-500" : "text-red-500"
  return (
    <span className={`flex items-center gap-1 font-medium ${color}`}>
      <Icon className="size-3.5" />
      {rate}%
    </span>
  )
}

export function PerformanceScorecardTable({ metrics, onEmployeeClick }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Performance Scorecard</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06]">
                <TableHead className="pl-4 w-8">#</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Overdue</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Docs</TableHead>
                <TableHead className="text-right pr-4">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8 text-sm">
                    No performance data for this period.
                  </TableCell>
                </TableRow>
              ) : (
                metrics.map((m, i) => (
                  <TableRow
                    key={m.employeeId}
                    className="cursor-pointer hover:bg-white/[0.03] border-white/[0.06]"
                    onClick={() => onEmployeeClick(m.employeeId)}
                  >
                    <TableCell className="pl-4 text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{m.employeeName}</p>
                        {m.department && (
                          <p className="text-[11px] text-muted-foreground">{m.department}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ScoreBadge score={m.performanceScore} />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {m.tasksCompleted}/{m.tasksAssigned}
                    </TableCell>
                    <TableCell className="text-right">
                      <RateCell rate={m.completionRate} />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {m.overdueTasks > 0 ? (
                        <span className="text-red-500 font-medium">{m.overdueTasks}</span>
                      ) : (
                        <span className="text-emerald-500">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{m.activeClients}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{m.documentsProcessed}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums pr-4">
                      {m.revenueManaged > 0
                        ? `₹${(m.revenueManaged / 1000).toFixed(0)}k`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
