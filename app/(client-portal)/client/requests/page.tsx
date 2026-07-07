import { redirect } from "next/navigation"
import { CalendarClock, ClipboardList } from "lucide-react"

import {
  getMyDocumentRequests,
  type MyDocumentRequest,
} from "@/app/actions/document-requests"
import { getSession } from "@/lib/auth/session"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { RequestItemUpload } from "./item-upload"

const ITEM_STATUS_STYLES: Record<string, string> = {
  PENDING: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  UPLOADED: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  ACCEPTED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  REJECTED: "border-red-500/30 bg-red-500/10 text-red-500",
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting upload",
  UPLOADED: "Under review",
  ACCEPTED: "Accepted",
  REJECTED: "Re-upload needed",
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default async function ClientDocumentRequestsPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  let requests: MyDocumentRequest[]
  try {
    requests = await getMyDocumentRequests()
  } catch {
    // Layout already guards role + identity; failing here means no/ambiguous
    // client record — mirror the layout's refusal.
    redirect("/unauthorized")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Requests</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Documents your tax team has asked you to upload.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="size-12 text-muted-foreground/30 mb-4" />
            <p className="font-medium">No pending document requests 🎉</p>
            <p className="text-sm text-muted-foreground mt-1">
              When your tax team needs documents from you, they will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        requests.map((request) => {
          const outstanding = request.items.filter(
            (item) => item.status === "PENDING" || item.status === "REJECTED"
          ).length

          return (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="size-5 text-primary" />
                      {request.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {outstanding === 0
                        ? "All items submitted — awaiting review by your tax team."
                        : `${outstanding} item${outstanding !== 1 ? "s" : ""} still needed.`}
                      {request.notes ? ` ${request.notes}` : ""}
                    </CardDescription>
                  </div>
                  {request.dueDate && (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-500"
                    >
                      <CalendarClock className="mr-1 size-3" />
                      Due {formatDate(request.dueDate)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {request.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border p-3 sm:p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0",
                            ITEM_STATUS_STYLES[item.status] ??
                              "text-muted-foreground"
                          )}
                        >
                          {ITEM_STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          {item.title}
                        </span>
                        {(item.status === "PENDING" ||
                          item.status === "REJECTED") && (
                          <RequestItemUpload
                            itemId={item.id}
                            itemTitle={item.title}
                            isReupload={item.status === "REJECTED"}
                          />
                        )}
                      </div>
                      {item.status === "REJECTED" && item.rejectionReason && (
                        <p className="mt-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm font-medium text-red-500">
                          Please re-upload: {item.rejectionReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
