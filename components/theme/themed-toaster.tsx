"use client"

import { Toaster } from "sonner"
import { useTheme } from "next-themes"

/** Sonner toaster that follows the active theme instead of hardcoding dark. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      theme={resolvedTheme === "light" ? "light" : "dark"}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "border border-white/[0.08] bg-popover/95 text-foreground backdrop-blur-xl shadow-xl",
        },
      }}
    />
  )
}
