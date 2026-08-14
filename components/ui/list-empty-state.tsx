"use client"

/**
 * An empty list, and what to do about it.
 *
 * Empty states mostly restated the obvious — "No invoices match the current
 * filters" — and stopped there, which leaves the reader to work out both what
 * went wrong and how to undo it. Worse, the two reasons a list can be empty
 * need opposite advice, and the app gave the same message for both: a list with
 * nothing in it wants "create the first one", while a list hidden behind a
 * filter wants "clear the filter". Telling someone to create their first
 * invoice when they have two hundred and a status filter on is not a small
 * mistake — it is the app misreading the situation out loud.
 *
 * `filtered` picks which of those two it is. When filters are the cause, the
 * active ones are named, because "no results" plus an invisible filter is how
 * people conclude their data is gone.
 */

import type { LucideIcon } from "lucide-react"
import { SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  /** Icon for the "nothing here yet" case. The filtered case always uses SearchX. */
  icon: LucideIcon
  /** True when the underlying list has rows but the filters hide all of them. */
  filtered: boolean
  /** What the list holds, lower case and plural — "invoices", "tasks". */
  noun: string
  /** One line on what this list is for, shown only when genuinely empty. */
  emptyHint: string
  /** Human labels for the filters currently narrowing the list. */
  activeFilters?: string[]
  onClearFilters?: () => void
  /** The create action, shown only when the list is genuinely empty. */
  action?: { label: string; onClick: () => void }
  className?: string
}

export function ListEmptyState({
  icon: Icon,
  filtered,
  noun,
  emptyHint,
  activeFilters = [],
  onClearFilters,
  action,
  className,
}: Props) {
  const Glyph = filtered ? SearchX : Icon

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        <Glyph className="size-6 text-muted-foreground" aria-hidden />
      </div>

      <p className="font-medium text-foreground">
        {filtered ? `No ${noun} match these filters` : `No ${noun} yet`}
      </p>

      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? activeFilters.length > 0
            ? `Filtering by ${activeFilters.join(", ")}. There are ${noun} here — they're just hidden by that.`
            : `There are ${noun} here, but nothing matches what you've narrowed to.`
          : emptyHint}
      </p>

      {filtered
        ? onClearFilters && (
            <Button size="sm" variant="outline" className="mt-1" onClick={onClearFilters}>
              Clear filters
            </Button>
          )
        : action && (
            <Button size="sm" className="mt-1" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
    </div>
  )
}
