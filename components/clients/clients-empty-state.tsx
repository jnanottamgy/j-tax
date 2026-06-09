import { Building2, SearchX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ClientsEmptyStateProps = {
  variant?: "no-results" | "no-clients"
  onClearFilters?: () => void
  className?: string
}

export function ClientsEmptyState({
  variant = "no-results",
  onClearFilters,
  className,
}: ClientsEmptyStateProps) {
  const isFiltered = variant === "no-results"

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
        <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-white/[0.07] bg-gradient-to-br from-primary/15 to-transparent ring-1 ring-primary/15">
          {isFiltered ? (
            <SearchX className="size-7 text-muted-foreground" />
          ) : (
            <Building2 className="size-7 text-primary" />
          )}
        </div>
      </div>

      <h3 className="text-base font-semibold tracking-tight">
        {isFiltered ? "No clients match your filters" : "No clients yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {isFiltered
          ? "Try adjusting your search terms or filters to find what you're looking for."
          : "Add your first client to start managing tax profiles, assignments, and compliance deadlines."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {isFiltered && onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="input-premium rounded-xl"
          >
            Clear filters
          </Button>
        )}
        {!isFiltered && (
          <p className="text-xs text-muted-foreground mt-2">
            Use the <span className="font-medium text-foreground">Add Client</span> button above to get started.
          </p>
        )}
      </div>
    </div>
  )
}
