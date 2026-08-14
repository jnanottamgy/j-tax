"use client"

/**
 * Every match, grouped — as opposed to the command palette's first five.
 *
 * The palette caps each type at five with no way to see the rest, which makes
 * it a jump tool: fine for reaching a client you can already name, useless for
 * finding one you can't. "Sharma" matching eleven clients showed five and said
 * nothing about the other six, so the honest conclusion from the palette was
 * that they did not exist.
 */

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Building2,
  Calendar,
  CheckSquare,
  FileText,
  Receipt,
  Search as SearchIcon,
  Users,
} from "lucide-react"

import { GlassCard } from "@/components/dashboard/glass-card"
import { Input } from "@/components/ui/input"
import { globalSearch, type SearchResult } from "@/app/actions/search"

const PER_TYPE = 50

const GROUPS: Array<{ type: string; label: string; icon: typeof Building2 }> = [
  { type: "CLIENT", label: "Clients", icon: Building2 },
  { type: "TASK", label: "Tasks", icon: CheckSquare },
  { type: "INVOICE", label: "Invoices", icon: Receipt },
  { type: "DOCUMENT", label: "Documents", icon: FileText },
  { type: "EMPLOYEE", label: "Team", icon: Users },
  { type: "COMPLIANCE", label: "Deadlines", icon: Calendar },
]

export function SearchResultsClient() {
  const router = useRouter()
  const params = useSearchParams()
  const initial = params.get("q") ?? ""

  const [query, setQuery] = useState(initial)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const q = initial.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    globalSearch(q, { limit: PER_TYPE })
      .then((r) => { if (!cancelled) setResults(r.results) })
      .catch(() => { if (!cancelled) setResults([]) })
    return () => { cancelled = true }
  }, [initial])

  function runSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    startTransition(() => {
      router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search")
    })
  }

  const grouped = GROUPS.map((g) => ({
    ...g,
    rows: (results ?? []).filter((r) => r.type === g.type),
  })).filter((g) => g.rows.length > 0)

  const total = results?.length ?? 0

  return (
    <div className="space-y-6">
      <form onSubmit={runSearch}>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients, tasks, invoices, deadlines…"
            className="input-premium h-11 rounded-xl pl-10"
            autoFocus
          />
        </div>
      </form>

      {results === null ? (
        <p className="px-1 text-sm text-muted-foreground">Searching…</p>
      ) : !initial.trim() ? (
        <p className="px-1 text-sm text-muted-foreground">
          Type anything a record is known by — a name, a client code, a GSTIN, a PAN, an
          invoice number.
        </p>
      ) : total === 0 ? (
        <GlassCard hover={false} className="p-12 text-center">
          <p className="font-medium">
            Nothing matches “{initial}”
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Search covers names, client codes, GSTIN, PAN, email and phone. A partial
            spelling works; a wrong one does not.
          </p>
        </GlassCard>
      ) : (
        <>
          <p className="px-1 text-sm text-muted-foreground">
            {total} result{total === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-foreground">“{initial}”</span>
            {total === PER_TYPE * GROUPS.length && " (showing the first page)"}
          </p>

          {grouped.map((group) => (
            <GlassCard key={group.type} hover={false} className="overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-white/[0.05] px-5 py-3">
                <group.icon className="size-4 text-muted-foreground" aria-hidden />
                <h2 className="text-sm font-medium">{group.label}</h2>
                <span className="text-xs text-muted-foreground">{group.rows.length}</span>
              </div>
              <ul>
                {group.rows.map((row) => (
                  <li key={`${row.type}-${row.id}`}>
                    <Link
                      href={row.url}
                      className="flex items-baseline gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.035]"
                    >
                      <span className="text-sm font-medium">{row.title}</span>
                      {row.subtitle && (
                        <span className="truncate text-xs text-muted-foreground">
                          {row.subtitle}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </>
      )}
    </div>
  )
}
