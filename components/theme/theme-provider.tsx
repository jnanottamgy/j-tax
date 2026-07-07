"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * App-wide theme switching (light / dark / system).
 *
 * - `attribute="class"` toggles the `.dark` class that globals.css keys off.
 * - `defaultTheme="dark"` preserves the original J-TACS look for everyone
 *   until they opt into light or system.
 * - `disableTransitionOnChange` avoids a wave of mismatched CSS transitions
 *   when hundreds of surfaces re-color at once.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
