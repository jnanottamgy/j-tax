import Link from "next/link"
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Inbox } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getWorkQueue, type QueueTone } from "@/app/actions/work-queue"
import { cn } from "@/lib/utils"

const TONE: Record<QueueTone, { text: string; dot: string; icon: typeof Clock }> = {
  urgent: { text: "text-red-400", dot: "bg-red-400", icon: AlertTriangle },
  attention: { text: "text-amber-400", dot: "bg-amber-400", icon: Inbox },
  info: { text: "text-muted-foreground", dot: "bg-muted-foreground/60", icon: Clock },
}

/**
 * The handoff queues — what is sitting on this person right now.
 *
 * Rendered above the metric tiles because a number you cannot act on is worth
 * less than a list you can. Every row links straight to the task, so acting on
 * it is one click rather than a hunt through the work tracker.
 */
export async function WorkQueuePanel() {
  const queues = await getWorkQueue()
  if (queues.length === 0) return null

  const totalWaiting = queues.reduce((s, q) => s + q.total, 0)

  return (
    <Card className="border-white/[0.08] bg-white/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Inbox className="size-4 text-primary" />
          Needs you
          {totalWaiting > 0 && (
            <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
              {totalWaiting}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {queues.map((q) => {
          const tone = TONE[q.tone]
          return (
            <div
              key={q.key}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", tone.dot)} />
                <p className="text-[13px] font-medium">{q.label}</p>
                {q.total > 0 && (
                  <span className={cn("ml-auto text-sm font-semibold tabular-nums", tone.text)}>
                    {q.total}
                  </span>
                )}
              </div>

              {q.items.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                  <CheckCircle2 className="size-3.5 text-emerald-400/70" />
                  {q.emptyText}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {q.items.map((it) => (
                    <li key={it.id}>
                      <Link
                        href={it.href}
                        className="group flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-white/[0.04]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] leading-snug">{it.title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {it.subtitle}
                            {it.meta ? ` · ${it.meta}` : ""}
                          </p>
                        </div>
                        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
