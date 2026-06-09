// Design tokens for consistent UI across the application
export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem",  // 8px
  md: "0.75rem", // 12px
  lg: "1rem",    // 16px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "2rem",   // 32px
  "4xl": "2.5rem", // 40px
  "5xl": "3rem",   // 48px
  "6xl": "4rem",   // 64px
} as const

export const borderRadius = {
  sm: "0.5rem",  // 8px
  md: "0.75rem", // 12px
  lg: "1rem",    // 16px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "2rem",   // 32px
  full: "9999px",
} as const

export const fontSize = {
  xs: "0.75rem",   // 12px
  sm: "0.875rem",  // 14px
  base: "1rem",    // 16px
  lg: "1.125rem",  // 18px
  xl: "1.25rem",   // 20px
  "2xl": "1.5rem",  // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem",  // 36px
  "5xl": "3rem",     // 48px
} as const

export const fontWeight = {
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const

export const lineHeight = {
  tight: "1.25",
  normal: "1.5",
  relaxed: "1.75",
  loose: "2",
} as const

export const boxShadow = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  glow: "0 0 0 1px oklch(0.7 0.16 265/25%), 0 4px 16px -4px oklch(0.55 0.15 265/40%), 0 8px 24px -8px oklch(0.5 0.12 265/30%)",
} as const

export const transition = {
  fast: "150ms ease-in-out",
  normal: "300ms ease-in-out",
  slow: "500ms ease-in-out",
} as const

export const zIndex = {
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modal: 40,
  tooltip: 50,
  notification: 60,
} as const
