import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  label?: string
  title: string
  description?: string
  className?: string
  action?: React.ReactNode
  backHref?: string
}

export function PageHeader({
  label,
  title,
  description,
  className,
  action,
  backHref,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-3">
        {backHref && (
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
        )}
        {label && <p className="label-premium">{label}</p>}
        <h1 className="text-gradient text-3xl font-semibold tracking-tight md:text-[2rem] md:leading-tight lg:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
