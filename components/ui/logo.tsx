"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * J-TACS brand mark — inline SVG, gold (#D6C0A0), scalable, theme-agnostic.
 * Sourced from public/branding/finsal.svg, tightened viewBox for runtime use.
 *
 * The SVG is inlined (not <img>) so the `glow` prop can apply a drop-shadow
 * filter without a per-render network fetch.
 */

interface LogoIconProps {
  /** px size of the square icon */
  size?: number
  className?: string
  /** suffix for SVG gradient IDs — kept for backward-compat with prior API */
  idSuffix?: string
  /** show animated glow ring */
  glow?: boolean
}

export function LogoIcon({
  size = 36,
  className,
  // idSuffix kept for backward-compat with prior API; not used in new mark
  idSuffix: _idSuffix = "a",
  glow = false,
}: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="590 375 190 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "shrink-0 transition-all duration-300",
        glow && "drop-shadow-[0_0_14px_oklch(0.78_0.15_75/55%)]",
        className
      )}
      aria-label="J-TACS logo"
      role="img"
    >
      <g fill="#D6C0A0">
        <path d="M615.3,435.014c1.652,0,64.973-53.006,64.973-53.006l64.973,53.006-64.973-22.228Z" transform="translate(0.523 -1.434)" />
        <path d="M663.4,424.023l18.243-6.081,16.032,6.081-3.87,5.528L693.1,633.4s-3.431,28.373-20.845,52.56-49.582,41.095-49.582,41.095,20.208-20.816,30.97-44.073S667.2,633.4,667.2,633.4l.075-203.845Z" />
        <path d="M605.885,447.828,595.048,492.76s9.691-12.951,14.185-18.414,17.68-4.992,17.68-4.992h18.8V456.087s-19.527.447-29.34-1.211S605.885,447.828,605.885,447.828Z" />
        <path d="M634.873,447.828l10.837,44.933s-9.691-12.951-14.185-18.414-17.68-4.992-17.68-4.992h-18.8V456.087s19.527.447,29.34-1.211S634.873,447.828,634.873,447.828Z" transform="translate(120)" />
      </g>
    </svg>
  )
}

/**
 * Full wordmark — icon + "J-TACS" + "TAX • COMPLIANCE • INTELLIGENCE" tagline.
 * Built from vectors + text so it scales crisply, respects theme colour, and
 * doesn't carry a baked-in background.
 *
 * For social / OG / print use cases where a bitmap is required, reference
 * `/branding/jtacs-full-logo.png` directly.
 */

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
        "group flex items-center gap-3 transition-all duration-300",
        className
      )}
    >
      <LogoIcon
        size={iconSize}
        idSuffix={idSuffix}
        glow={glow}
        className="group-hover:scale-105 group-hover:drop-shadow-[0_0_12px_oklch(0.78_0.15_75/65%)] transition-all duration-300"
      />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-semibold tracking-[0.16em]",
            // gold gradient wordmark
            "bg-gradient-to-b from-[#F0E2C0] via-[#D6C0A0] to-[#B69960] bg-clip-text text-transparent",
            "group-hover:brightness-110 transition-all duration-300",
            textClassName
          )}
          style={{ fontSize: Math.max(13, iconSize * 0.55) }}
        >
          J-TACS
        </span>
        {showTagline && (
          <span
            className="text-[8.5px] tracking-[0.30em] text-[#B69960]/85 uppercase mt-1"
            style={{ fontSize: Math.max(8, iconSize * 0.22) }}
          >
            Tax · Compliance · Intelligence
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Marketing / OG / print contexts — the full pre-rendered PNG with baked-in
 * dark background. Use this for social-share images, email banners, PDF
 * cover pages.
 *
 * For runtime UI surfaces, prefer LogoFull (vector) so the logo blends into
 * the surrounding canvas instead of sitting on its own opaque plate.
 */

interface LogoMarketingProps {
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

export function LogoMarketing({
  width = 480,
  height = 320,
  className,
  priority = false,
}: LogoMarketingProps) {
  return (
    <Image
      src="/branding/jtacs-full-logo.png"
      alt="J-TACS — Tax · Compliance · Intelligence"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto", className)}
    />
  )
}

/**
 * Animated loading / splash version — icon pulses inside a soft glow ring.
 */

interface LogoLoadingProps {
  size?: number
  className?: string
}

export function LogoLoading({ size = 56, className }: LogoLoadingProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full animate-ping opacity-20"
          style={{
            width: size + 24,
            height: size + 24,
            background:
              "radial-gradient(circle, oklch(0.80 0.15 75 / 60%), transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse opacity-30"
          style={{
            width: size + 12,
            height: size + 12,
            background:
              "radial-gradient(circle, oklch(0.78 0.15 75 / 50%), transparent 70%)",
          }}
        />
        <LogoIcon size={size} idSuffix="loading" glow />
      </div>
      <span
        className="text-xs tracking-[0.3em] uppercase font-semibold bg-gradient-to-r from-[#F0E2C0] via-[#D6C0A0] to-[#B69960] bg-clip-text text-transparent"
      >
        J-TACS
      </span>
    </div>
  )
}
