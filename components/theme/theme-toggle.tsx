"use client"

import { useEffect, useState } from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Light / Dark / System switcher. The trigger shows the RESOLVED theme's
 * icon; the menu marks the SELECTED preference (which may be "system").
 * Renders a neutral placeholder until mounted to avoid a hydration mismatch
 * (the server doesn't know the stored preference).
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 text-muted-foreground transition-colors duration-300 hover:bg-white/[0.05] hover:text-foreground"
          aria-label="Change theme"
        >
          {!mounted ? (
            <Moon className="size-4" />
          ) : resolvedTheme === "light" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => setTheme(opt.value)}
            className={
              mounted && theme === opt.value ? "bg-accent text-accent-foreground" : undefined
            }
          >
            <opt.icon className="size-3.5" />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
