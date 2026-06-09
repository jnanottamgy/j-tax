"use client"

import { cn } from "@/lib/utils"

// ─── Gradient IDs must be globally unique ───────────────────────────
// We pass a unique suffix so multiple logo instances don't clash.

interface LogoIconProps {
  /** px size of the square icon */
  size?: number
  className?: string
  /** suffix for SVG gradient IDs to avoid duplicate-id issues */
  idSuffix?: string
  /** show animated glow ring  */
  glow?: boolean
}

/**
 * Compact square icon — faithful recreation of the J-TAX logo as pure SVG.
 * Shape: a stylised capital J
 *   • top horizontal bar
 *   • vertical stem
 *   • mid detached crossbar
 *   • hook / bowl at the bottom
 */
export function LogoIcon({
  size = 36,
  className,
  idSuffix = "a",
  glow = false,
}: LogoIconProps) {
  const gradId = `logo-grad-${idSuffix}`
  const glowId = `logo-glow-${idSuffix}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "shrink-0 transition-all duration-300",
        glow && "drop-shadow-[0_0_12px_oklch(0.7_0.22_265/60%)]",
        className
      )}
      aria-label="J-TAX logo"
    >
      <defs>
        {/* Electric blue → purple gradient matching the dashboard theme */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="oklch(0.75 0.22 240)" />
          <stop offset="50%"  stopColor="oklch(0.65 0.22 265)" />
          <stop offset="100%" stopColor="oklch(0.55 0.20 295)" />
        </linearGradient>
        {/* Soft glow filter */}
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g fill={`url(#${gradId})`} filter={glow ? `url(#${glowId})` : undefined}>
        {/* ── Top horizontal cap bar ── */}
        <rect x="42" y="17" width="28" height="10" rx="2" />

        {/* ── Vertical stem ── */}
        <rect x="59" y="17" width="11" height="46" rx="2" />

        {/* ── Mid detached crossbar (the signature gap detail) ── */}
        <rect x="59" y="53" width="21" height="9" rx="2" />

        {/* ── Hook / bowl at the bottom (open-bottom C shape) ──
             Built from an annular arc approximated with a path.
             Outer radius ≈ 26, inner radius ≈ 16, centre at (50,70) */}
        <path
          d="
            M 50 56
            C 30 56  18 66  18 76
            C 18 88  30 96  50 96
            C 65 96  74 90  78 81
            L 68 77
            C 65 84  58 88  50 88
            C 35 88  27 82  27 76
            C 27 68  37 64  50 64
            Z
          "
        />
      </g>
    </svg>
  )
}

// ─── Full wordmark: icon + "J-TAX" text ──────────────────────────────

interface LogoFullProps {
  iconSize?: number
  className?: string
  textClassName?: string
  idSuffix?: string
  glow?: boolean
  showTagline?: boolean
}

export function LogoFull({
  iconSize = 32,
  className,
  textClassName,
  idSuffix = "b",
  glow = false,
  showTagline = false,
}: LogoFullProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 transition-all duration-300",
        className
      )}
    >
      <LogoIcon
        size={iconSize}
        idSuffix={idSuffix}
        glow={glow}
        className="group-hover:scale-105 group-hover:drop-shadow-[0_0_10px_oklch(0.7_0.22_265/50%)] transition-all duration-300"
      />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "text-sm font-bold tracking-wider",
            // gradient text matching the logo gradient
            "bg-gradient-to-r from-[oklch(0.75_0.22_240)] via-[oklch(0.65_0.22_265)] to-[oklch(0.55_0.20_295)] bg-clip-text text-transparent",
            "group-hover:brightness-110 transition-all duration-300",
            textClassName
          )}
          style={{ letterSpacing: "0.12em" }}
        >
          J-TAX
        </span>
        {showTagline && (
          <span className="text-[10px] text-muted-foreground tracking-[0.12em] uppercase mt-0.5">
            Enterprise
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Animated loading / splash version ───────────────────────────────

interface LogoLoadingProps {
  size?: number
  className?: string
}

export function LogoLoading({ size = 56, className }: LogoLoadingProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Outer glow ring */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full animate-ping opacity-20"
          style={{
            width: size + 24,
            height: size + 24,
            background:
              "radial-gradient(circle, oklch(0.7 0.22 265 / 60%), transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse opacity-30"
          style={{
            width: size + 12,
            height: size + 12,
            background:
              "radial-gradient(circle, oklch(0.65 0.22 265 / 50%), transparent 70%)",
          }}
        />
        <LogoIcon size={size} idSuffix="loading" glow />
      </div>
      <span
        className="text-xs tracking-[0.3em] uppercase font-semibold"
        style={{
          background:
            "linear-gradient(90deg, oklch(0.75 0.22 240), oklch(0.65 0.22 265), oklch(0.55 0.20 295))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        J-TAX
      </span>
    </div>
  )
}
