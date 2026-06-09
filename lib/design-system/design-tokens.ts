/**
 * J-TAX Design System Tokens
 * 
 * Unified design tokens for consistent spacing, typography, colors, and components.
 * Based on Linear, Stripe, Attio, Mercury, Vercel, and Notion design patterns.
 */

// ==================== SPACING SCALE ====================
// 4px base unit scale
export const spacing = {
  0: '0',
  1: '0.25rem',  // 4px
  2: '0.5rem',   // 8px
  3: '0.75rem',  // 12px
  4: '1rem',     // 16px
  5: '1.25rem',  // 20px
  6: '1.5rem',   // 24px
  8: '2rem',     // 32px
  10: '2.5rem',  // 40px
  12: '3rem',    // 48px
  16: '4rem',    // 64px
  20: '5rem',    // 80px
  24: '6rem',    // 96px
} as const

// ==================== TYPOGRAPHY ====================
export const typography = {
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '0.9375rem',  // 15px (body default)
    lg: '1rem',         // 16px
    xl: '1.125rem',     // 18px
    '2xl': '1.25rem',   // 20px
    '3xl': '1.5rem',    // 24px
    '4xl': '1.875rem',  // 30px
    '5xl': '2.25rem',   // 36px
    '6xl': '3rem',      // 48px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const

// ==================== BORDER RADIUS ====================
export const borderRadius = {
  none: '0',
  sm: 'calc(var(--radius) * 0.5)',   // ~6px
  md: 'calc(var(--radius) * 0.75)',  // ~9px
  lg: 'var(--radius)',                // ~12px
  xl: 'calc(var(--radius) * 1.25)',   // ~15px
  '2xl': 'calc(var(--radius) * 1.5)', // ~18px
  full: '9999px',
} as const

// ==================== SHADOWS ====================
export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  glass: '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 4px 24px -6px rgba(0,0,0,0.35), 0 20px 48px -16px rgba(0,0,0,0.4)',
  glassHover: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 8px 32px -8px rgba(0,0,0,0.4), 0 24px 56px -16px rgba(0,0,0,0.45)',
  glow: '0 0 0 1px oklch(0.7 0.16 265/25%), 0 4px 16px -4px oklch(0.55 0.15 265/40%), 0 8px 24px -8px oklch(0.5 0.12 265/30%)',
  glowHover: '0 0 0 1px oklch(0.75 0.17 265/35%), 0 6px 20px -4px oklch(0.55 0.15 265/50%), 0 12px 32px -8px oklch(0.5 0.12 265/35%)',
} as const

// ==================== ANIMATIONS ====================
export const animations = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
    slower: '700ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
} as const

// ==================== Z-INDEX SCALE ====================
export const zIndex = {
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modal: 40,
  popover: 50,
  tooltip: 60,
} as const

// ==================== COMPONENT SPECIFIC ====================
export const component = {
  // Button heights
  button: {
    xs: '1.5rem',   // 24px
    sm: '1.75rem',  // 28px
    md: '2rem',     // 32px
    lg: '2.25rem',  // 36px
    xl: '2.5rem',   // 40px
  },
  // Input heights
  input: {
    sm: '2rem',     // 32px
    md: '2.25rem',  // 36px
    lg: '2.5rem',   // 40px
  },
  // Card padding
  card: {
    sm: '1rem',     // 16px
    md: '1.25rem',  // 20px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
  },
  // Table cell padding
  table: {
    cell: {
      sm: '0.5rem',   // 8px
      md: '0.75rem',  // 12px
      lg: '1rem',     // 16px
    },
  },
} as const

// ==================== LAYOUT ====================
export const layout = {
  container: {
    narrow: '48rem',    // 768px
    default: '105rem',  // 1680px
    wide: '120rem',     // 1920px
  },
  sidebar: {
    width: '16rem',     // 256px
    collapsed: '4rem', // 64px
  },
  header: {
    height: '4rem',     // 64px
  },
} as const

// ==================== UTILITY CLASSES ====================
export const utilityClasses = {
  // Text gradients
  textGradient: 'bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent',
  textGradientPrimary: 'bg-gradient-to-br from-primary to-sky-500 bg-clip-text text-transparent',
  
  // Premium label
  labelPremium: 'text-[11px] font-semibold tracking-[0.14em] text-primary/90 uppercase',
  
  // Glass card
  glassCard: 'relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.055] to-white/[0.015] shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_4px_24px_-6px_rgba(0,0,0,0.35),0_20px_48px_-16px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-[border-color,box-shadow,transform,background] duration-500 ease-out',
  glassCardHover: 'hover:border-white/[0.1] hover:from-white/[0.07] hover:to-white/[0.025] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_8px_32px_-8px_rgba(0,0,0,0.4),0_24px_56px_-16px_rgba(0,0,0,0.45)] hover:-translate-y-px',
  
  // Surface elevated
  surfaceElevated: 'rounded-xl border border-white/[0.06] bg-white/[0.03] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all duration-300 hover:border-white/[0.09] hover:bg-white/[0.045]',
  
  // Premium input
  inputPremium: 'border-white/[0.07] bg-white/[0.035] shadow-[0_1px_2px_rgba(0,0,0,0.12)_inset] transition-all duration-300 placeholder:text-muted-foreground/55 focus-visible:border-primary/30 focus-visible:bg-white/[0.05] focus-visible:shadow-[0_0_0_3px_oklch(0.7_0.16_265/12%)]',
  
  // Button glow
  btnGlow: 'shadow-[0_0_0_1px_oklch(0.7_0.16_265/25%),0_4px_16px_-4px_oklch(0.55_0.15_265/40%),0_8px_24px_-8px_oklch(0.5_0.12_265/30%)] transition-all duration-300 hover:shadow-[0_0_0_1px_oklch(0.75_0.17_265/35%),0_6px_20px_-4px_oklch(0.55_0.15_265/50%),0_12px_32px_-8px_oklch(0.5_0.12_265/35%)] hover:brightness-110',
  
  // Page enter animation
  pageEnter: 'animate-in fade-in slide-in-from-bottom-3 duration-700 ease-out',
  
  // Stagger animations
  stagger1: 'animation-delay-50ms',
  stagger2: 'animation-delay-100ms',
  stagger3: 'animation-delay-150ms',
  stagger4: 'animation-delay-200ms',
} as const
