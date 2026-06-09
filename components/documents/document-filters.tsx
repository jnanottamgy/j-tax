"use client"

import { useState } from "react"
import { Search, Filter, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type DocumentCategory = "GST" | "TDS" | "ROC" | "AUDIT" | "INCOME_TAX" | "PAYROLL" | "BANK_STATEMENTS" | "INVOICES" | "AGREEMENTS" | "OTHER"

interface Client {
  id: string
  name: string
}

interface DocumentFiltersProps {
  onFiltersChange: (filters: {
    clientId?: string
    category?: string
    search?: string
  }) => void
  clients: Client[]
}

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "GST", label: "GST" },
  { value: "TDS", label: "TDS" },
  { value: "ROC", label: "ROC" },
  { value: "AUDIT", label: "Audit" },
  { value: "INCOME_TAX", label: "Income Tax" },
  { value: "PAYROLL", label: "Payroll" },
  { value: "BANK_STATEMENTS", label: "Bank Statements" },
  { value: "INVOICES", label: "Invoices" },
  { value: "AGREEMENTS", label: "Agreements" },
  { value: "OTHER", label: "Other" },
]

export function DocumentFilters({ onFiltersChange, clients }: DocumentFiltersProps) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()
  const [selectedClient, setSelectedClient] = useState<string | undefined>()

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFiltersChange({
      category: selectedCategory,
      clientId: selectedClient,
      search: value || undefined,
    })
  }

  const handleCategoryChange = (category: string | undefined) => {
    setSelectedCategory(category)
    onFiltersChange({
      category,
      clientId: selectedClient,
      search: search || undefined,
    })
  }

  const handleClientChange = (clientId: string | undefined) => {
    setSelectedClient(clientId)
    onFiltersChange({
      category: selectedCategory,
      clientId,
      search: search || undefined,
    })
  }

  const clearAllFilters = () => {
    setSearch("")
    setSelectedCategory(undefined)
    setSelectedClient(undefined)
    onFiltersChange({})
  }

  const hasActiveFilters = selectedCategory || selectedClient || search

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Search */}
      <div className="relative flex-1 w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10 h-10 input-premium rounded-xl"
        />
      </div>

      {/* Category Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 rounded-xl gap-2",
              selectedCategory && "bg-primary/10 border-primary/20 text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            Category
            {selectedCategory && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {CATEGORY_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleCategoryChange(selectedCategory === option.value ? undefined : option.value)}
              className={cn(selectedCategory === option.value && "bg-accent")}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Client Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 rounded-xl gap-2",
              selectedClient && "bg-primary/10 border-primary/20 text-primary"
            )}
          >
            <Filter className="h-4 w-4" />
            Client
            {selectedClient && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{clients.find(c => c.id === selectedClient)?.name}</Badge>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Filter by Client</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleClientChange(undefined)}
            className={cn(!selectedClient && "bg-accent")}
          >
            All Clients
          </DropdownMenuItem>
          {clients.map((client) => (
            <DropdownMenuItem
              key={client.id}
              onClick={() => handleClientChange(selectedClient === client.id ? undefined : client.id)}
              className={cn(selectedClient === client.id && "bg-accent")}
            >
              {client.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-10 rounded-xl gap-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  )
}
