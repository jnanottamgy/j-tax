import { cn } from "@/lib/utils"

type SectionHeadingProps = {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-[13px] leading-relaxed text-muted-foreground/90">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
