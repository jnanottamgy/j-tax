import { cn } from "@/lib/utils"

type PageContainerProps = {
  children: React.ReactNode
  className?: string
  size?: "default" | "narrow" | "wide"
}

const sizeClasses = {
  default: "max-w-[1680px]",
  narrow: "max-w-3xl",
  wide: "max-w-[1920px]",
}

export function PageContainer({
  children,
  className,
  size = "default",
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "page-enter relative z-[1] mx-auto w-full space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  )
}
