import { cn } from "@/lib/utils"

type GlassCardProps = React.ComponentProps<"div"> & {
  hover?: boolean
  glow?: boolean
}

export function GlassCard({
  className,
  hover = true,
  glow = false,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        !hover && "glass-card-static",
        glow && "kpi-glow",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
