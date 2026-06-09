"use client"

import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-2 text-sm", className)}>
      <Link
        href="/"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {item.href ? (
            <Link
              href={item.href}
              className={cn(
                "hover:text-foreground transition-colors",
                index === items.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn(index === items.length - 1 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}
