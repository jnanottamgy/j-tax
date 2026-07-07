"use client"

import { useState } from "react"
import { ClipboardList, Plus } from "lucide-react"

import type {
  ClientOption,
  DocumentRequestListRow,
} from "@/app/actions/document-requests"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { NewRequestDialog } from "./new-request-dialog"
import { RequestDetailDialog } from "./request-detail-dialog"

export function formatEnInDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const REQUEST_STATUS_STYLES: Record<string, string> = {
  OPEN: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  CANCELLED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
}

export function RequestStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(REQUEST_STATUS_STYLES[status] ?? "text-muted-foreground")}
    >
      {status}
    </Badge>
  )
}

const ITEM_STATUS_STYLES: Record<string, string> = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  UPLOADED: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  ACCEPTED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  REJECTED: "border-red-500/30 bg-red-500/10 text-red-400",
}

export function ItemStatusChip({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(ITEM_STATUS_STYLES[status] ?? "text-muted-foreground")}
    >
      {status}
    </Badge>
  )
}

type RequestListClientProps = {
  requests: DocumentRequestListRow[]
  clientOptions: ClientOption[]
}

export function RequestListClient({
  requests,
  clientOptions,
}: RequestListClientProps) {
  const [newOpen, setNewOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNewOpen(true)} className="btn-glow">
          <Plus className="mr-2 size-4" />
          New request
        </Button>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No document requests yet"
          description="Create a request to ask a client for a list of documents. Outstanding items are auto-chased by email."
          action={{ label: "New request", onClick: () => setNewOpen(true) }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Last reminded</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(req.id)}
                    >
                      <TableCell className="font-medium">
                        {req.clientName}
                      </TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            req.itemStats.accepted === req.itemStats.total &&
                              req.itemStats.total > 0
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-white/[0.08] bg-white/[0.03] text-muted-foreground"
                          )}
                        >
                          {req.itemStats.accepted}/{req.itemStats.total} accepted
                        </Badge>
                        {req.itemStats.uploaded > 0 && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 border-blue-500/30 bg-blue-500/10 text-blue-400"
                          >
                            {req.itemStats.uploaded} to review
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <RequestStatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatEnInDate(req.dueDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatEnInDate(req.lastRemindedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatEnInDate(req.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <NewRequestDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        clientOptions={clientOptions}
      />

      {detailId && (
        <RequestDetailDialog
          requestId={detailId}
          open={detailId !== null}
          onOpenChange={(open) => {
            if (!open) setDetailId(null)
          }}
        />
      )}
    </div>
  )
}
